import { env } from './env'
import { serve } from '@hono/node-server'
import { app } from './app'

// Local dev server (Vercel uses the default export)
if (env.NODE_ENV !== 'production') {
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`Loop API running at http://localhost:${info.port}`)
  })
}

export default app
