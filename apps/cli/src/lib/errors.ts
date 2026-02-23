import type { LoopError as LoopErrorType } from '@dork-labs/loop-sdk';

/** Check if an error is a LoopError by duck-typing its properties. */
function isLoopError(error: unknown): error is LoopErrorType {
  return (
    error instanceof Error &&
    'status' in error &&
    'code' in error &&
    typeof (error as LoopErrorType).status === 'number' &&
    typeof (error as LoopErrorType).code === 'string'
  );
}

/**
 * Wrap a command action with centralized error handling.
 * Maps SDK errors to user-friendly messages and exits with code 1.
 */
export async function withErrorHandler(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (isLoopError(error)) {
      if (error.status === 401 || error.status === 403) {
        console.error('Authentication failed. Run: loop auth login');
      } else if (error.status === 404) {
        console.error(`Not found: ${error.message}`);
      } else {
        console.error(`API error (${error.status}): ${error.message}`);
      }
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
