import { serve } from '@hono/node-server'
import { app } from './app'

// Local dev server (Vercel uses the default export)
if (process.env.NODE_ENV !== 'production') {
  const port = parseInt(process.env.PORT || '4242', 10)
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Loop API running at http://localhost:${info.port}`)
  })
}

export default app
