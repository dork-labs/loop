import { describe, it, expect } from 'vitest';
import {
  LoopError,
  LoopNotFoundError,
  LoopValidationError,
  LoopConflictError,
  LoopRateLimitError,
} from '../errors';

describe('LoopError', () => {
  it('constructs with all fields', () => {
    const err = new LoopError('test', 500, 'TEST', { foo: 'bar' });
    expect(err.message).toBe('test');
    expect(err.status).toBe(500);
    expect(err.code).toBe('TEST');
    expect(err.details).toEqual({ foo: 'bar' });
    expect(err.name).toBe('LoopError');
    expect(err).toBeInstanceOf(Error);
  });

  describe('fromResponse', () => {
    it('maps 404 to LoopNotFoundError', () => {
      const err = LoopError.fromResponse(404, { error: 'Not found' });
      expect(err).toBeInstanceOf(LoopNotFoundError);
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    });

    it('maps 409 to LoopConflictError', () => {
      const err = LoopError.fromResponse(409, { error: 'Conflict' });
      expect(err).toBeInstanceOf(LoopConflictError);
      expect(err.status).toBe(409);
    });

    it('maps 422 to LoopValidationError with details', () => {
      const err = LoopError.fromResponse(422, { error: 'Invalid', details: { field: 'name' } });
      expect(err).toBeInstanceOf(LoopValidationError);
      expect(err.details).toEqual({ field: 'name' });
    });

    it('maps 429 to LoopRateLimitError', () => {
      const err = LoopError.fromResponse(429, { error: 'Rate limited' });
      expect(err).toBeInstanceOf(LoopRateLimitError);
    });

    it('maps unknown status to base LoopError', () => {
      const err = LoopError.fromResponse(503, { error: 'Service unavailable' });
      expect(err).toBeInstanceOf(LoopError);
      expect(err.code).toBe('HTTP_503');
    });

    it('handles missing error message', () => {
      const err = LoopError.fromResponse(500, {});
      expect(err.message).toBe('Unknown error');
    });
  });
});
