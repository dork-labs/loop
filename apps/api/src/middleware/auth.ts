import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { timingSafeEqual } from 'node:crypto'
import type { AppEnv } from '../types'

/** Bearer token auth middleware that validates requests against LOOP_API_KEY. */
export const apiKeyAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: 'Missing or malformed Authorization header',
    })
  }

  const token = authHeader.slice(7)
  const expected = process.env.LOOP_API_KEY

  if (!expected) {
    throw new HTTPException(500, { message: 'LOOP_API_KEY not configured' })
  }

  const tokenBuf = Buffer.from(token)
  const expectedBuf = Buffer.from(expected)

  if (
    tokenBuf.length !== expectedBuf.length ||
    !timingSafeEqual(tokenBuf, expectedBuf)
  ) {
    throw new HTTPException(401, { message: 'Invalid API key' })
  }

  await next()
})
