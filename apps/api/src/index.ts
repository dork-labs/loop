import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ ok: true, service: 'loop-api', timestamp: new Date().toISOString() })
})

app.get('/', (c) => {
  return c.json({ name: 'Loop API', version: '0.1.0' })
})

// Local dev server (Vercel uses the default export)
if (process.env.NODE_ENV !== 'production') {
  const port = parseInt(process.env.PORT || '4242', 10)
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Loop API running at http://localhost:${info.port}`)
  })
}

export default app
