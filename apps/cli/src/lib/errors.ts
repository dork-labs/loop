import { HTTPError } from 'ky'

/**
 * Wrap a command action with centralized error handling.
 * Maps HTTP errors to user-friendly messages and exits with code 1.
 */
export async function withErrorHandler(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (error instanceof HTTPError) {
      const status = error.response.status
      const body = await error.response.json().catch(() => null)
      const message = (body as Record<string, string> | null)?.error ?? error.message

      if (status === 401 || status === 403) {
        console.error('Authentication failed. Run: looped config set token <your-token>')
      } else if (status === 404) {
        console.error(`Not found: ${message}`)
      } else {
        console.error(`API error (${status}): ${message}`)
      }
    } else {
      console.error(`Error: ${(error as Error).message}`)
    }
    process.exit(1)
  }
}
