import { createHmac } from 'node:crypto'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { webhookRoutes } from '../routes/webhooks'
import { withTestDb, getTestDb, type TestAppEnv } from './setup'

// ─── Test secrets ───────────────────────────────────────────────────────────

const TEST_GITHUB_SECRET = 'gh-test-secret-1234'
const TEST_SENTRY_SECRET = 'sentry-test-secret-1234'
const TEST_POSTHOG_SECRET = 'posthog-test-secret-1234'

/** Compute HMAC-SHA256 hex digest for test payloads. */
function hmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Creates a Hono app with DB injection and webhook routes at /api/signals. */
function createWebhookApp() {
  const app = new Hono<TestAppEnv>()

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    return c.json({ error: 'Internal server error' }, 500)
  })

  app.use('*', async (c, next) => {
    c.set('db', getTestDb())
    await next()
  })

  app.route('/api/signals', webhookRoutes)

  return app
}

// ─── Environment variable management ────────────────────────────────────────

const savedEnv: Record<string, string | undefined> = {}

function saveAndSetEnv(vars: Record<string, string>) {
  for (const [key, value] of Object.entries(vars)) {
    savedEnv[key] = process.env[key]
    process.env[key] = value
  }
}

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value !== undefined) {
      process.env[key] = value
    } else {
      delete process.env[key]
    }
  }
}

// ─── PostHog Webhook Signals ────────────────────────────────────────────────

describe('POST /api/signals/posthog', () => {
  withTestDb()

  beforeEach(() => {
    saveAndSetEnv({ POSTHOG_WEBHOOK_SECRET: TEST_POSTHOG_SECRET })
  })

  afterEach(() => {
    restoreEnv()
  })

  it('creates a signal and issue with valid secret', async () => {
    const app = createWebhookApp()
    const payload = {
      name: 'page_load_time',
      value: 30,
      timeframe: '24h',
    }

    const res = await app.request('/api/signals/posthog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostHog-Secret': TEST_POSTHOG_SECRET,
      },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.signal).toBeDefined()
    expect(body.data.issue).toBeDefined()
    expect(body.data.signal.source).toBe('posthog')
    expect(body.data.signal.type).toBe('metric_change')
    expect(body.data.signal.issueId).toBe(body.data.issue.id)
    expect(body.data.issue.type).toBe('signal')
    expect(body.data.issue.status).toBe('triage')
  })

  it('derives title from metric name, value, and timeframe', async () => {
    const app = createWebhookApp()
    const payload = { name: 'error_rate', value: 55, timeframe: '1h' }

    const res = await app.request('/api/signals/posthog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostHog-Secret': TEST_POSTHOG_SECRET,
      },
      body: JSON.stringify(payload),
    })

    const body = await res.json()
    expect(body.data.issue.title).toBe('PostHog: error_rate 55% (1h)')
  })

  it('maps high change magnitude to critical severity', async () => {
    const app = createWebhookApp()
    const payload = { name: 'metric', value: 60 }

    const res = await app.request('/api/signals/posthog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostHog-Secret': TEST_POSTHOG_SECRET,
      },
      body: JSON.stringify(payload),
    })

    const body = await res.json()
    expect(body.data.signal.severity).toBe('critical')
    expect(body.data.issue.priority).toBe(1)
  })

  it('maps low change magnitude to low severity', async () => {
    const app = createWebhookApp()
    const payload = { name: 'metric', value: 5 }

    const res = await app.request('/api/signals/posthog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostHog-Secret': TEST_POSTHOG_SECRET,
      },
      body: JSON.stringify(payload),
    })

    const body = await res.json()
    expect(body.data.signal.severity).toBe('low')
    expect(body.data.issue.priority).toBe(4)
  })

  it('rejects requests with invalid secret', async () => {
    const app = createWebhookApp()

    const res = await app.request('/api/signals/posthog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostHog-Secret': 'wrong-secret',
      },
      body: JSON.stringify({ name: 'test' }),
    })

    expect(res.status).toBe(401)
  })
})

// ─── GitHub Webhook Signals ─────────────────────────────────────────────────

describe('POST /api/signals/github', () => {
  withTestDb()

  beforeEach(() => {
    saveAndSetEnv({ GITHUB_WEBHOOK_SECRET: TEST_GITHUB_SECRET })
  })

  afterEach(() => {
    restoreEnv()
  })

  function githubRequest(
    app: Hono<TestAppEnv>,
    payload: Record<string, unknown>,
    eventType = 'push',
  ) {
    const body = JSON.stringify(payload)
    const sig = `sha256=${hmacSha256(TEST_GITHUB_SECRET, body)}`

    return app.request('/api/signals/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': eventType,
      },
      body,
    })
  }

  it('creates a signal and issue with valid signature', async () => {
    const app = createWebhookApp()
    const payload = {
      repository: { full_name: 'dork-labs/loop' },
      sender: { login: 'octocat' },
    }

    const res = await githubRequest(app, payload)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.signal).toBeDefined()
    expect(body.data.issue).toBeDefined()
    expect(body.data.signal.source).toBe('github')
    expect(body.data.signal.type).toBe('push')
    expect(body.data.signal.issueId).toBe(body.data.issue.id)
    expect(body.data.issue.type).toBe('signal')
    expect(body.data.issue.status).toBe('triage')
  })

  it('derives title from event type, repo, and actor', async () => {
    const app = createWebhookApp()
    const payload = {
      repository: { full_name: 'dork-labs/loop' },
      sender: { login: 'octocat' },
    }

    const res = await githubRequest(app, payload, 'issues')
    const body = await res.json()

    expect(body.data.issue.title).toBe('GitHub: issues on dork-labs/loop by octocat')
  })

  it('maps security_advisory event to critical severity', async () => {
    const app = createWebhookApp()
    const payload = {
      repository: { full_name: 'dork-labs/loop' },
      sender: { login: 'dependabot' },
    }

    const res = await githubRequest(app, payload, 'security_advisory')
    const body = await res.json()

    expect(body.data.signal.severity).toBe('critical')
    expect(body.data.issue.priority).toBe(1)
  })

  it('sets sourceId from event type and action', async () => {
    const app = createWebhookApp()
    const payload = {
      action: 'opened',
      repository: { full_name: 'dork-labs/loop' },
      sender: { login: 'octocat' },
    }

    const res = await githubRequest(app, payload, 'issues')
    const body = await res.json()

    expect(body.data.signal.sourceId).toBe('issues.opened')
  })

  it('rejects requests with invalid signature', async () => {
    const app = createWebhookApp()

    const res = await app.request('/api/signals/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=invalid',
        'X-GitHub-Event': 'push',
      },
      body: JSON.stringify({ test: true }),
    })

    expect(res.status).toBe(401)
  })
})

// ─── Sentry Webhook Signals ────────────────────────────────────────────────

describe('POST /api/signals/sentry', () => {
  withTestDb()

  beforeEach(() => {
    saveAndSetEnv({ SENTRY_CLIENT_SECRET: TEST_SENTRY_SECRET })
  })

  afterEach(() => {
    restoreEnv()
  })

  function sentryRequest(app: Hono<TestAppEnv>, payload: Record<string, unknown>) {
    const body = JSON.stringify(payload)
    const canonical = JSON.stringify(JSON.parse(body))
    const sig = hmacSha256(TEST_SENTRY_SECRET, canonical)

    return app.request('/api/signals/sentry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sentry-Hook-Signature': sig,
      },
      body,
    })
  }

  it('creates a signal and issue with valid signature', async () => {
    const app = createWebhookApp()
    const payload = {
      action: 'created',
      data: {
        issue: {
          id: '12345',
          title: 'TypeError: Cannot read property of null',
          count: 42,
          level: 'error',
        },
      },
    }

    const res = await sentryRequest(app, payload)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.signal).toBeDefined()
    expect(body.data.issue).toBeDefined()
    expect(body.data.signal.source).toBe('sentry')
    expect(body.data.signal.type).toBe('created')
    expect(body.data.signal.issueId).toBe(body.data.issue.id)
    expect(body.data.issue.type).toBe('signal')
    expect(body.data.issue.status).toBe('triage')
  })

  it('derives title from error title and event count', async () => {
    const app = createWebhookApp()
    const payload = {
      action: 'created',
      data: {
        issue: {
          id: '123',
          title: 'ReferenceError: foo is not defined',
          count: 15,
          level: 'error',
        },
      },
    }

    const res = await sentryRequest(app, payload)
    const body = await res.json()

    expect(body.data.issue.title).toBe('Sentry: ReferenceError: foo is not defined (15 events)')
  })

  it('maps fatal level to critical severity', async () => {
    const app = createWebhookApp()
    const payload = {
      action: 'created',
      data: {
        issue: {
          id: '123',
          title: 'OOM Killer',
          count: 1,
          level: 'fatal',
        },
      },
    }

    const res = await sentryRequest(app, payload)
    const body = await res.json()

    expect(body.data.signal.severity).toBe('critical')
    expect(body.data.issue.priority).toBe(1)
  })

  it('maps high-frequency error to critical severity', async () => {
    const app = createWebhookApp()
    const payload = {
      action: 'created',
      data: {
        issue: {
          id: '123',
          title: 'Connection timeout',
          count: 150,
          level: 'error',
        },
      },
    }

    const res = await sentryRequest(app, payload)
    const body = await res.json()

    expect(body.data.signal.severity).toBe('critical')
  })

  it('maps warning level to medium severity', async () => {
    const app = createWebhookApp()
    const payload = {
      action: 'created',
      data: {
        issue: {
          id: '123',
          title: 'Deprecated API usage',
          count: 5,
          level: 'warning',
        },
      },
    }

    const res = await sentryRequest(app, payload)
    const body = await res.json()

    expect(body.data.signal.severity).toBe('medium')
    expect(body.data.issue.priority).toBe(3)
  })

  it('sets sourceId from Sentry issue id', async () => {
    const app = createWebhookApp()
    const payload = {
      action: 'created',
      data: {
        issue: {
          id: '99999',
          title: 'Test error',
          count: 1,
          level: 'error',
        },
      },
    }

    const res = await sentryRequest(app, payload)
    const body = await res.json()

    expect(body.data.signal.sourceId).toBe('99999')
  })

  it('rejects requests with invalid signature', async () => {
    const app = createWebhookApp()

    const res = await app.request('/api/signals/sentry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sentry-Hook-Signature': 'invalid-sig',
      },
      body: JSON.stringify({ action: 'created', data: {} }),
    })

    expect(res.status).toBe(401)
  })
})
