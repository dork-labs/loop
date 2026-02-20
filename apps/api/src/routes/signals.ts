import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { signals, signalSeverityValues } from '../db/schema/signals'
import { issues } from '../db/schema/issues'
import type { TestAppEnv } from '../__tests__/setup'

// ─── Validation schema ──────────────────────────────────────────────────────

const createSignalSchema = z.object({
  source: z.string().min(1),
  sourceId: z.string().optional(),
  type: z.string().min(1),
  severity: z.enum(signalSeverityValues),
  payload: z.record(z.string(), z.unknown()),
  projectId: z.string().optional(),
})

// ─── Severity → priority mapping ────────────────────────────────────────────

const SEVERITY_PRIORITY_MAP: Record<(typeof signalSeverityValues)[number], number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Derive a human-readable issue title from signal data. */
function deriveIssueTitle(source: string, type: string, payload: Record<string, unknown>): string {
  const summary =
    typeof payload.message === 'string'
      ? payload.message
      : typeof payload.title === 'string'
        ? payload.title
        : type
  return `[${source}] ${type}: ${summary}`
}

// ─── Route handler ──────────────────────────────────────────────────────────

/**
 * Signal ingestion routes — generic POST endpoint for creating signals.
 * Each signal atomically creates a corresponding triage issue in a transaction.
 */
export const signalRoutes = new Hono<TestAppEnv>()

/** POST / — Ingest a signal and atomically create a linked triage issue. */
signalRoutes.post('/', zValidator('json', createSignalSchema), async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')

  const priority = SEVERITY_PRIORITY_MAP[data.severity]
  const title = deriveIssueTitle(data.source, data.type, data.payload)

  // Atomic transaction: create Issue then Signal so they're linked.
  const result = await db.transaction(async (tx) => {
    const [issue] = await tx
      .insert(issues)
      .values({
        title,
        type: 'signal',
        status: 'triage',
        priority,
        projectId: data.projectId ?? null,
        signalSource: data.source,
        signalPayload: data.payload,
      })
      .returning()

    const [signal] = await tx
      .insert(signals)
      .values({
        source: data.source,
        sourceId: data.sourceId ?? null,
        type: data.type,
        severity: data.severity,
        payload: data.payload,
        issueId: issue.id,
      })
      .returning()

    return { signal, issue }
  })

  return c.json({ data: result }, 201)
})
