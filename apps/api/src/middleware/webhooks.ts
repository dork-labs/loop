import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AppEnv } from '../app'

/**
 * Compares two strings using timing-safe equality to prevent timing attacks.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Computes an HMAC-SHA256 hex digest of the given payload.
 *
 * @param secret - The HMAC secret key
 * @param payload - The message to sign
 * @returns Hex-encoded HMAC-SHA256 digest
 */
function computeHmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Middleware that verifies GitHub webhook signatures using HMAC-SHA256.
 *
 * Reads the raw body via `c.req.text()`, computes the expected signature
 * from `GITHUB_WEBHOOK_SECRET`, and compares it to the `X-Hub-Signature-256`
 * header value using `crypto.timingSafeEqual`.
 */
export const verifyGitHubWebhook = createMiddleware<AppEnv>(async (c, next) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    throw new HTTPException(500, { message: 'GITHUB_WEBHOOK_SECRET not configured' })
  }

  const signature = c.req.header('X-Hub-Signature-256')
  if (!signature) {
    throw new HTTPException(401, { message: 'Missing X-Hub-Signature-256 header' })
  }

  const rawBody = await c.req.text()
  const expected = `sha256=${computeHmacSha256(secret, rawBody)}`

  if (!safeCompare(expected, signature)) {
    throw new HTTPException(401, { message: 'Invalid webhook signature' })
  }

  await next()
})

/**
 * Middleware that verifies Sentry webhook signatures using HMAC-SHA256.
 *
 * Reads the body, parses as JSON, re-serializes for HMAC computation,
 * and compares against the `Sentry-Hook-Signature` header using
 * `crypto.timingSafeEqual`.
 */
export const verifySentryWebhook = createMiddleware<AppEnv>(async (c, next) => {
  const secret = process.env.SENTRY_CLIENT_SECRET
  if (!secret) {
    throw new HTTPException(500, { message: 'SENTRY_CLIENT_SECRET not configured' })
  }

  const signature = c.req.header('Sentry-Hook-Signature')
  if (!signature) {
    throw new HTTPException(401, { message: 'Missing Sentry-Hook-Signature header' })
  }

  const body = await c.req.text()
  // Re-serialize through JSON.parse/stringify to match Sentry's canonical form
  const canonical = JSON.stringify(JSON.parse(body))
  const expected = computeHmacSha256(secret, canonical)

  if (!safeCompare(expected, signature)) {
    throw new HTTPException(401, { message: 'Invalid webhook signature' })
  }

  await next()
})

/**
 * Middleware that verifies PostHog webhooks via shared secret comparison.
 *
 * Checks the `X-PostHog-Secret` header against `POSTHOG_WEBHOOK_SECRET`
 * using `crypto.timingSafeEqual`. No HMAC computation is needed — PostHog
 * sends the raw secret in the header.
 */
export const verifyPostHogWebhook = createMiddleware<AppEnv>(async (c, next) => {
  const secret = process.env.POSTHOG_WEBHOOK_SECRET
  if (!secret) {
    throw new HTTPException(500, { message: 'POSTHOG_WEBHOOK_SECRET not configured' })
  }

  const headerSecret = c.req.header('X-PostHog-Secret')
  if (!headerSecret) {
    throw new HTTPException(401, { message: 'Missing X-PostHog-Secret header' })
  }

  if (!safeCompare(secret, headerSecret)) {
    throw new HTTPException(401, { message: 'Invalid webhook secret' })
  }

  await next()
})
