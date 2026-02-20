import { createHmac } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { AppEnv } from '../types'
import {
  verifyGitHubWebhook,
  verifySentryWebhook,
  verifyPostHogWebhook,
} from '../middleware/webhooks'

const TEST_GITHUB_SECRET = 'gh-test-secret-1234'
const TEST_SENTRY_SECRET = 'sentry-test-secret-1234'
const TEST_POSTHOG_SECRET = 'posthog-test-secret-1234'

/** Compute HMAC-SHA256 hex digest for test payloads. */
function hmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Creates a minimal Hono app with the given middleware protecting a test route. */
function createWebhookApp(middleware: MiddlewareHandler<AppEnv>) {
  const app = new Hono<AppEnv>()
  app.use('/webhook', middleware)
  app.post('/webhook', (c) => c.json({ ok: true }))
  return app
}

// ---------------------------------------------------------------------------
// GitHub Webhook Verification
// ---------------------------------------------------------------------------
describe('verifyGitHubWebhook', () => {
  const savedSecret = process.env.GITHUB_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = TEST_GITHUB_SECRET
  })

  afterEach(() => {
    if (savedSecret !== undefined) {
      process.env.GITHUB_WEBHOOK_SECRET = savedSecret
    } else {
      delete process.env.GITHUB_WEBHOOK_SECRET
    }
  })

  it('passes with a valid signature', async () => {
    const app = createWebhookApp(verifyGitHubWebhook)
    const body = JSON.stringify({ action: 'opened', issue: { number: 1 } })
    const sig = `sha256=${hmacSha256(TEST_GITHUB_SECRET, body)}`

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': sig,
      },
      body,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects with an invalid signature', async () => {
    const app = createWebhookApp(verifyGitHubWebhook)
    const body = JSON.stringify({ action: 'opened' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=invalid-signature',
      },
      body,
    })

    expect(res.status).toBe(401)
  })

  it('rejects when the signature header is missing', async () => {
    const app = createWebhookApp(verifyGitHubWebhook)
    const body = JSON.stringify({ action: 'opened' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(res.status).toBe(401)
  })

  it('returns 500 when GITHUB_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET
    const app = createWebhookApp(verifyGitHubWebhook)
    const body = JSON.stringify({ action: 'opened' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Sentry Webhook Verification
// ---------------------------------------------------------------------------
describe('verifySentryWebhook', () => {
  const savedSecret = process.env.SENTRY_CLIENT_SECRET

  beforeEach(() => {
    process.env.SENTRY_CLIENT_SECRET = TEST_SENTRY_SECRET
  })

  afterEach(() => {
    if (savedSecret !== undefined) {
      process.env.SENTRY_CLIENT_SECRET = savedSecret
    } else {
      delete process.env.SENTRY_CLIENT_SECRET
    }
  })

  it('passes with a valid signature', async () => {
    const app = createWebhookApp(verifySentryWebhook)
    const payload = { action: 'created', data: { issue: { id: '123' } } }
    const body = JSON.stringify(payload)
    // Sentry computes HMAC over the canonical (re-serialized) JSON
    const canonical = JSON.stringify(JSON.parse(body))
    const sig = hmacSha256(TEST_SENTRY_SECRET, canonical)

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sentry-Hook-Signature': sig,
      },
      body,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects with an invalid signature', async () => {
    const app = createWebhookApp(verifySentryWebhook)
    const body = JSON.stringify({ action: 'created' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sentry-Hook-Signature': 'invalid-signature',
      },
      body,
    })

    expect(res.status).toBe(401)
  })

  it('rejects when the signature header is missing', async () => {
    const app = createWebhookApp(verifySentryWebhook)
    const body = JSON.stringify({ action: 'created' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(res.status).toBe(401)
  })

  it('returns 500 when SENTRY_CLIENT_SECRET is not configured', async () => {
    delete process.env.SENTRY_CLIENT_SECRET
    const app = createWebhookApp(verifySentryWebhook)
    const body = JSON.stringify({ action: 'created' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// PostHog Webhook Verification
// ---------------------------------------------------------------------------
describe('verifyPostHogWebhook', () => {
  const savedSecret = process.env.POSTHOG_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.POSTHOG_WEBHOOK_SECRET = TEST_POSTHOG_SECRET
  })

  afterEach(() => {
    if (savedSecret !== undefined) {
      process.env.POSTHOG_WEBHOOK_SECRET = savedSecret
    } else {
      delete process.env.POSTHOG_WEBHOOK_SECRET
    }
  })

  it('passes with a valid secret header', async () => {
    const app = createWebhookApp(verifyPostHogWebhook)
    const body = JSON.stringify({ event: 'test' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostHog-Secret': TEST_POSTHOG_SECRET,
      },
      body,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects with an invalid secret', async () => {
    const app = createWebhookApp(verifyPostHogWebhook)
    const body = JSON.stringify({ event: 'test' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostHog-Secret': 'wrong-secret',
      },
      body,
    })

    expect(res.status).toBe(401)
  })

  it('rejects when the secret header is missing', async () => {
    const app = createWebhookApp(verifyPostHogWebhook)
    const body = JSON.stringify({ event: 'test' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(res.status).toBe(401)
  })

  it('returns 500 when POSTHOG_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.POSTHOG_WEBHOOK_SECRET
    const app = createWebhookApp(verifyPostHogWebhook)
    const body = JSON.stringify({ event: 'test' })

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    expect(res.status).toBe(500)
  })
})
