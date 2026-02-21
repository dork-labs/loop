import { describe, it, expect } from 'vitest'
import { apiEnvSchema } from '../env'

describe('API env schema', () => {
  it('accepts valid config with all required fields', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing DATABASE_URL', () => {
    const result = apiEnvSchema.safeParse({
      LOOP_API_KEY: 'test-key',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid DATABASE_URL format', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'not-a-url',
      LOOP_API_KEY: 'test-key',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty LOOP_API_KEY', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: '',
    })
    expect(result.success).toBe(false)
  })

  it('applies defaults for optional fields', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development')
      expect(result.data.PORT).toBe(4242)
      expect(result.data.LOOP_URL).toBe('http://localhost:4242')
    }
  })

  it('coerces PORT from string to number', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
      PORT: '3000',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.PORT).toBe(3000)
    }
  })

  it('rejects PORT outside valid range', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
      PORT: '99999',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional webhook secrets', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
      GITHUB_WEBHOOK_SECRET: 'gh-secret',
      SENTRY_CLIENT_SECRET: 'sentry-secret',
      POSTHOG_WEBHOOK_SECRET: 'posthog-secret',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.GITHUB_WEBHOOK_SECRET).toBe('gh-secret')
      expect(result.data.SENTRY_CLIENT_SECRET).toBe('sentry-secret')
      expect(result.data.POSTHOG_WEBHOOK_SECRET).toBe('posthog-secret')
    }
  })

  it('rejects invalid NODE_ENV value', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
      NODE_ENV: 'staging',
    })
    expect(result.success).toBe(false)
  })
})
