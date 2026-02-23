/**
 * Base error class for all Loop SDK errors.
 * Provides structured error information from the API.
 */
export class LoopError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'LoopError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Create a typed error from an HTTP response status and body.
   *
   * @param status - HTTP status code
   * @param body - Parsed JSON response body
   */
  static fromResponse(status: number, body: Record<string, unknown>): LoopError {
    const message = (body.error as string) ?? 'Unknown error';
    const details = body.details as Record<string, unknown> | undefined;

    switch (status) {
      case 404:
        return new LoopNotFoundError(message);
      case 409:
        return new LoopConflictError(message);
      case 422:
        return new LoopValidationError(message, details);
      case 429:
        return new LoopRateLimitError(message);
      default:
        return new LoopError(message, status, `HTTP_${status}`, details);
    }
  }
}

/** Thrown when the requested resource does not exist (404). */
export class LoopNotFoundError extends LoopError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'LoopNotFoundError';
  }
}

/** Thrown when request body fails validation (422). */
export class LoopValidationError extends LoopError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, 'VALIDATION_ERROR', details);
    this.name = 'LoopValidationError';
  }
}

/** Thrown on duplicate/conflict errors (409). */
export class LoopConflictError extends LoopError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'LoopConflictError';
  }
}

/** Thrown when rate-limited by the server (429). */
export class LoopRateLimitError extends LoopError {
  constructor(message: string) {
    super(message, 429, 'RATE_LIMITED');
    this.name = 'LoopRateLimitError';
  }
}
