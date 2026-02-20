import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { apiKeyAuth } from './middleware/auth'
import { db } from './db'
import { issueRoutes } from './routes/issues'
import { projectRoutes } from './routes/projects'
import { goalRoutes } from './routes/goals'
import { labelRoutes } from './routes/labels'
import { issueRelationRoutes, relationRoutes } from './routes/relations'
import { commentRoutes } from './routes/comments'
import { signalRoutes } from './routes/signals'
import { templateRoutes } from './routes/templates'
import { promptReviewRoutes } from './routes/prompt-reviews'
import { webhookRoutes } from './routes/webhooks'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

/** Global error handler for HTTPException, ZodError, and unexpected errors. */
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  if (err instanceof ZodError) {
    return c.json({ error: 'Validation error', details: err.flatten() }, 422)
  }
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

// Health check (no auth)
app.get('/health', (c) =>
  c.json({ ok: true, service: 'loop-api', timestamp: new Date().toISOString() })
)
app.get('/', (c) => c.json({ name: 'Loop API', version: '0.1.0' }))

// Protected API routes — all /api/* endpoints require a valid Bearer token.
const api = new Hono<AppEnv>()
api.use('*', apiKeyAuth)

/** Inject the production database into every request context. */
api.use('*', async (c, next) => {
  c.set('db', db)
  await next()
})

// ─── Core CRUD routes ─────────────────────────────────────────────────────────
api.route('/issues', issueRoutes)
api.route('/issues', issueRelationRoutes)
api.route('/issues', commentRoutes)
api.route('/projects', projectRoutes)
api.route('/goals', goalRoutes)
api.route('/labels', labelRoutes)
api.route('/relations', relationRoutes)
api.route('/signals', signalRoutes)
api.route('/templates', templateRoutes)
api.route('/prompt-reviews', promptReviewRoutes)

app.route('/api', api)

// ─── Webhook routes (provider-specific auth, not apiKeyAuth) ────────────────
const webhooks = new Hono<AppEnv>()

/** Inject the production database into webhook request context. */
webhooks.use('*', async (c, next) => {
  c.set('db', db)
  await next()
})

webhooks.route('/signals', webhookRoutes)
app.route('/api', webhooks)

export { app, api }
