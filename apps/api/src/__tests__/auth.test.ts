import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { apiKeyAuth } from '../middleware/auth'

/**
 * Sets up a minimal Hono app with the auth middleware guarding a test route.
 * Includes the same error handler as the production app so HTTPExceptions
 * are serialised as JSON.
 */
function createAuthTestApp() {
  const app = new Hono()
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    return c.json({ error: 'Internal server error' }, 500)
  })
  app.use('/protected/*', apiKeyAuth)
  app.get('/protected/resource', (c) => c.json({ ok: true }))
  return app
}

describe('apiKeyAuth middleware', () => {
  const ORIGINAL_API_KEY = process.env.LOOP_API_KEY

  beforeEach(() => {
    process.env.LOOP_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    process.env.LOOP_API_KEY = ORIGINAL_API_KEY
  })

  it('rejects requests with no Authorization header with 401', async () => {
    const app = createAuthTestApp()
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Missing or malformed Authorization header')
  })

  it('rejects requests with malformed Authorization header (no Bearer prefix) with 401', async () => {
    const app = createAuthTestApp()
    const res = await app.request('/protected/resource', {
      headers: { Authorization: 'Basic test-api-key' },
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Missing or malformed Authorization header')
  })

  it('rejects requests with an invalid API key with 401', async () => {
    const app = createAuthTestApp()
    const res = await app.request('/protected/resource', {
      headers: { Authorization: 'Bearer wrong-key' },
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid API key')
  })

  it('passes requests with a valid API key through to the handler', async () => {
    const app = createAuthTestApp()
    const res = await app.request('/protected/resource', {
      headers: { Authorization: 'Bearer test-api-key' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 500 when LOOP_API_KEY is not configured', async () => {
    delete process.env.LOOP_API_KEY

    const app = createAuthTestApp()
    const res = await app.request('/protected/resource', {
      headers: { Authorization: 'Bearer some-key' },
    })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('LOOP_API_KEY not configured')
  })
})
