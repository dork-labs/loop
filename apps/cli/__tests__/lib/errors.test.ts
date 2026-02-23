import { describe, it, expect, vi, afterEach } from 'vitest';
import { LoopError, LoopNotFoundError } from '@dork-labs/loop-sdk';

async function loadModule() {
  vi.resetModules();
  return import('../../src/lib/errors.js');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withErrorHandler', () => {
  it('runs the function normally when no error occurs', async () => {
    const { withErrorHandler } = await loadModule();
    const fn = vi.fn().mockResolvedValue(undefined);

    await withErrorHandler(fn);

    expect(fn).toHaveBeenCalledOnce();
  });

  it('prints auth failure message for 401 status', async () => {
    const { withErrorHandler } = await loadModule();
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withErrorHandler(async () => {
        throw new LoopError('Unauthorized', 401, 'HTTP_401');
      })
    ).rejects.toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith(
      'Authentication failed. Run: loop auth login'
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('prints auth failure message for 403 status', async () => {
    const { withErrorHandler } = await loadModule();
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withErrorHandler(async () => {
        throw new LoopError('Forbidden', 403, 'HTTP_403');
      })
    ).rejects.toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith(
      'Authentication failed. Run: loop auth login'
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('prints "Not found" message for LoopNotFoundError', async () => {
    const { withErrorHandler } = await loadModule();
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withErrorHandler(async () => {
        throw new LoopNotFoundError('Issue not found');
      })
    ).rejects.toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith('Not found: Issue not found');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('prints status code and message for other LoopError statuses', async () => {
    const { withErrorHandler } = await loadModule();
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withErrorHandler(async () => {
        throw new LoopError('Internal server error', 500, 'HTTP_500');
      })
    ).rejects.toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith('API error (500): Internal server error');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('prints generic API error for LoopError with no specific handler', async () => {
    const { withErrorHandler } = await loadModule();
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withErrorHandler(async () => {
        throw new LoopError('Bad Gateway', 502, 'HTTP_502');
      })
    ).rejects.toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith('API error (502): Bad Gateway');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('prints error message for non-SDK errors', async () => {
    const { withErrorHandler } = await loadModule();
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withErrorHandler(async () => {
        throw new Error('Network timeout');
      })
    ).rejects.toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith('Error: Network timeout');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('handles non-Error objects gracefully', async () => {
    const { withErrorHandler } = await loadModule();
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withErrorHandler(async () => {
        throw 'string error';
      })
    ).rejects.toThrow('process.exit called');

    expect(mockError).toHaveBeenCalledWith('An unexpected error occurred');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('exits with code 1 for all errors', async () => {
    const { withErrorHandler } = await loadModule();
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withErrorHandler(async () => {
        throw new TypeError('Unexpected type');
      })
    ).rejects.toThrow('process.exit called');

    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
