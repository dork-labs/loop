import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'
import { apiKeyAuth } from '../middleware/auth'
import { env } from '../env'

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
      headers: { Authorization: 'Basic some-key' },
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
      headers: { Authorization: `Bearer ${env.LOOP_API_KEY}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
