import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { apiKeyAuth } from './middleware/auth';
import { db } from './db';
import { issueRoutes } from './routes/issues';
import { projectRoutes } from './routes/projects';
import { goalRoutes } from './routes/goals';
import { labelRoutes } from './routes/labels';
import { issueRelationRoutes, relationRoutes } from './routes/relations';
import { commentRoutes } from './routes/comments';
import { signalRoutes } from './routes/signals';
import { templateRoutes } from './routes/templates';
import { promptReviewRoutes } from './routes/prompt-reviews';
import { dispatchRoutes } from './routes/dispatch';
import { dashboardRoutes } from './routes/dashboard';
import { webhookRoutes } from './routes/webhooks';
import { openapiRoutes } from './routes/openapi';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

// CORS — allow the React dashboard and production app origins.
app.use(
  '*',
  cors({
    origin: ['http://localhost:5668', 'https://app.looped.me'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  })
);

/** Global error handler for HTTPException, ZodError, and unexpected errors. */
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json({ error: 'Validation error', details: err.flatten() }, 422);
  }
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Health check (no auth)
app.get('/health', (c) =>
  c.json({ ok: true, service: 'loop-api', timestamp: new Date().toISOString() })
);
app.get('/', (c) => c.json({ name: 'Loop API', version: '0.1.0' }));

// OpenAPI spec (no auth — public documentation endpoint)
app.route('/api/openapi.json', openapiRoutes);

// Protected API routes — all /api/* endpoints require a valid Bearer token.
const api = new Hono<AppEnv>();
api.use('*', apiKeyAuth);

/** Inject the production database into every request context. */
api.use('*', async (c, next) => {
  c.set('db', db);
  await next();
});

// ─── Core CRUD routes ─────────────────────────────────────────────────────────
api.route('/issues', issueRoutes);
api.route('/issues', issueRelationRoutes);
api.route('/issues', commentRoutes);
api.route('/projects', projectRoutes);
api.route('/goals', goalRoutes);
api.route('/labels', labelRoutes);
api.route('/relations', relationRoutes);
api.route('/signals', signalRoutes);
api.route('/templates', templateRoutes);
api.route('/prompt-reviews', promptReviewRoutes);
api.route('/dispatch', dispatchRoutes);
api.route('/dashboard', dashboardRoutes);

app.route('/api', api);

// ─── MCP transport (auth handled via internal ky client Bearer token) ────────
import { createMcpHandler } from '@dork-labs/loop-mcp/http';
import { env } from './env';
app.route('/mcp', createMcpHandler({ apiKey: env.LOOP_API_KEY }));

// ─── Webhook routes (provider-specific auth, not apiKeyAuth) ────────────────
const webhooks = new Hono<AppEnv>();

/** Inject the production database into webhook request context. */
webhooks.use('*', async (c, next) => {
  c.set('db', db);
  await next();
});

webhooks.route('/signals', webhookRoutes);
app.route('/api', webhooks);

export { app, api };
