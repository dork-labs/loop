import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listProjects,
  createProject,
  AuthError,
  NetworkError,
  ApiError,
  type ProjectListResponse,
  type LoopProject,
} from '../src/lib/api.js';

const API_URL = 'https://app.looped.me';
const API_KEY = 'loop_test_key_123';

function mockFetchResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('api', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('listProjects', () => {
    const projectsResponse: ProjectListResponse = {
      data: [
        { id: 'proj_1', name: 'My Project', status: 'active', description: null },
        { id: 'proj_2', name: 'Other Project', status: 'active', description: 'desc' },
      ],
      total: 2,
    };

    it('returns projects on success', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchResponse(projectsResponse));

      const result = await listProjects(API_URL, API_KEY);

      expect(result).toEqual(projectsResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(`${API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
    });

    it('throws AuthError on 401', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      try {
        await listProjects(API_URL, API_KEY);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as AuthError).message).toBe('Invalid API key');
      }
    });

    it('throws NetworkError on fetch failure', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      try {
        await listProjects(API_URL, API_KEY);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).message).toBe('Network error — could not reach Loop API');
      }
    });

    it('throws ApiError on 500', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      await expect(listProjects(API_URL, API_KEY)).rejects.toThrow(ApiError);
    });

    it('includes status code in ApiError', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response('Bad Request', { status: 400 })
      );

      try {
        await listProjects(API_URL, API_KEY);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
      }
    });
  });

  describe('createProject', () => {
    const createdProject: LoopProject = {
      id: 'proj_new',
      name: 'New Project',
      status: 'active',
      description: null,
    };

    it('returns created project on success', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        mockFetchResponse(createdProject, { status: 201 })
      );

      const result = await createProject(API_URL, API_KEY, 'New Project');

      expect(result).toEqual(createdProject);
      expect(globalThis.fetch).toHaveBeenCalledWith(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Project' }),
      });
    });

    it('throws AuthError on 401', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      await expect(createProject(API_URL, API_KEY, 'Test')).rejects.toThrow(AuthError);
    });

    it('throws NetworkError on fetch failure', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(createProject(API_URL, API_KEY, 'Test')).rejects.toThrow(NetworkError);
    });

    it('throws ApiError on 500', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      await expect(createProject(API_URL, API_KEY, 'Test')).rejects.toThrow(ApiError);
    });

    it('preserves original error as cause in NetworkError', async () => {
      const originalError = new TypeError('DNS resolution failed');
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(originalError);

      try {
        await createProject(API_URL, API_KEY, 'Test');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).cause).toBe(originalError);
      }
    });
  });
});
