import { Hono } from 'hono'
import { signals } from '../db/schema/signals'
import { issues } from '../db/schema/issues'
import {
  verifyGitHubWebhook,
  verifySentryWebhook,
  verifyPostHogWebhook,
} from '../middleware/webhooks'
import type { AppEnv, AnyDb } from '../types'
import type { signalSeverityValues } from '../db/schema/signals'

// ─── Types ──────────────────────────────────────────────────────────────────

type Severity = (typeof signalSeverityValues)[number]

// ─── Severity → priority mapping ────────────────────────────────────────────

const SEVERITY_PRIORITY_MAP: Record<Severity, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
}

// ─── GitHub event → severity mapping ────────────────────────────────────────

const GITHUB_EVENT_SEVERITY: Record<string, Severity> = {
  security_advisory: 'critical',
  code_scanning_alert: 'critical',
  dependabot_alert: 'high',
  pull_request: 'low',
  push: 'low',
  issues: 'medium',
  issue_comment: 'low',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derives PostHog severity from the magnitude of a metric change.
 *
 * @param changePercent - Absolute percentage change value
 * @returns Severity level based on change magnitude thresholds
 */
function derivePostHogSeverity(changePercent: number): Severity {
  const abs = Math.abs(changePercent)
  if (abs >= 50) return 'critical'
  if (abs >= 25) return 'high'
  if (abs >= 10) return 'medium'
  return 'low'
}

/**
 * Derives Sentry severity from the error level and event count.
 *
 * @param level - Sentry error level string
 * @param count - Number of events in the error group
 * @returns Severity level based on error level and frequency
 */
function deriveSentrySeverity(level: string, count: number): Severity {
  if (level === 'fatal') return 'critical'
  if (level === 'error' && count >= 100) return 'critical'
  if (level === 'error') return 'high'
  if (level === 'warning') return 'medium'
  return 'low'
}

// ─── Route handler ──────────────────────────────────────────────────────────

/**
 * Webhook signal routes for PostHog, GitHub, and Sentry.
 * Each endpoint uses provider-specific auth middleware (not apiKeyAuth).
 */
export const webhookRoutes = new Hono<AppEnv>()

/** POST /posthog — Ingest a PostHog webhook and create a signal + issue. */
webhookRoutes.post('/posthog', verifyPostHogWebhook, async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  const metricName = (body.event?.name ?? body.name ?? 'unknown_metric') as string
  const changePercent = typeof body.value === 'number' ? (body.value as number) : 0
  const timeframe = (body.timeframe ?? 'recent') as string

  const severity = derivePostHogSeverity(changePercent)
  const title = `PostHog: ${metricName} ${changePercent}% (${timeframe})`
  const payload = body as Record<string, unknown>

  const result = await db.transaction(async (tx: AnyDb) => {
    const [issue] = await tx
      .insert(issues)
      .values({
        title,
        type: 'signal',
        status: 'triage',
        priority: SEVERITY_PRIORITY_MAP[severity],
        projectId: null,
        signalSource: 'posthog',
        signalPayload: payload,
      })
      .returning()

    const [signal] = await tx
      .insert(signals)
      .values({
        source: 'posthog',
        sourceId: null,
        type: 'metric_change',
        severity,
        payload,
        issueId: issue.id,
      })
      .returning()

    return { signal, issue }
  })

  return c.json({ data: result }, 201)
})

/** POST /github — Ingest a GitHub webhook and create a signal + issue. */
webhookRoutes.post('/github', verifyGitHubWebhook, async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  const eventType = c.req.header('X-GitHub-Event') ?? 'unknown'
  const repo = (body.repository?.full_name ?? 'unknown') as string
  const actor = (body.sender?.login ?? 'unknown') as string

  const severity = GITHUB_EVENT_SEVERITY[eventType] ?? 'medium'
  const title = `GitHub: ${eventType} on ${repo} by ${actor}`
  const sourceId = body.action ? `${eventType}.${body.action}` : eventType
  const payload = body as Record<string, unknown>

  const result = await db.transaction(async (tx: AnyDb) => {
    const [issue] = await tx
      .insert(issues)
      .values({
        title,
        type: 'signal',
        status: 'triage',
        priority: SEVERITY_PRIORITY_MAP[severity],
        projectId: null,
        signalSource: 'github',
        signalPayload: payload,
      })
      .returning()

    const [signal] = await tx
      .insert(signals)
      .values({
        source: 'github',
        sourceId,
        type: eventType,
        severity,
        payload,
        issueId: issue.id,
      })
      .returning()

    return { signal, issue }
  })

  return c.json({ data: result }, 201)
})

/** POST /sentry — Ingest a Sentry webhook and create a signal + issue. */
webhookRoutes.post('/sentry', verifySentryWebhook, async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  const errorTitle = (body.data?.issue?.title ?? body.data?.error?.title ?? 'Unknown error') as string
  const count = Number(body.data?.issue?.count ?? body.data?.error?.count ?? 1)
  const level = (body.data?.issue?.level ?? body.data?.error?.level ?? 'error') as string

  const severity = deriveSentrySeverity(level, count)
  const title = `Sentry: ${errorTitle} (${count} events)`
  const issueId = body.data?.issue?.id
  const sourceId = issueId ? String(issueId) : null
  const payload = body as Record<string, unknown>

  const result = await db.transaction(async (tx: AnyDb) => {
    const [issue] = await tx
      .insert(issues)
      .values({
        title,
        type: 'signal',
        status: 'triage',
        priority: SEVERITY_PRIORITY_MAP[severity],
        projectId: null,
        signalSource: 'sentry',
        signalPayload: payload,
      })
      .returning()

    const [signal] = await tx
      .insert(signals)
      .values({
        source: 'sentry',
        sourceId,
        type: (body.action ?? 'event') as string,
        severity,
        payload,
        issueId: issue.id,
      })
      .returning()

    return { signal, issue }
  })

  return c.json({ data: result }, 201)
})
