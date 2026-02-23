/** Project returned by the Loop API. */
export interface LoopProject {
  id: string;
  name: string;
  status: string;
  description: string | null;
}

/** Paginated project list response. */
export interface ProjectListResponse {
  data: LoopProject[];
  total: number;
}

/** Thrown when the API returns 401 Unauthorized. */
export class AuthError extends Error {
  constructor() {
    super('Invalid API key');
    this.name = 'AuthError';
  }
}

/** Thrown on network failures (timeout, DNS, connection refused). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Network error — could not reach Loop API');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** Thrown for unexpected HTTP status codes. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`API error ${status}: ${message}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Fetch projects from the Loop API.
 *
 * @param apiUrl - Loop API base URL (e.g. https://app.looped.me)
 * @param apiKey - Bearer token for authentication
 * @returns Paginated project list
 * @throws AuthError on 401
 * @throws NetworkError on network failure
 * @throws ApiError on other HTTP errors
 */
export async function listProjects(apiUrl: string, apiKey: string): Promise<ProjectListResponse> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/projects`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    throw new NetworkError(err);
  }

  if (response.status === 401) throw new AuthError();
  if (!response.ok) throw new ApiError(response.status, await response.text());

  return response.json() as Promise<ProjectListResponse>;
}

/**
 * Create a new project in Loop.
 *
 * @param apiUrl - Loop API base URL
 * @param apiKey - Bearer token
 * @param name - Project name
 * @returns The created project
 * @throws AuthError on 401
 * @throws NetworkError on network failure
 * @throws ApiError on other HTTP errors
 */
export async function createProject(
  apiUrl: string,
  apiKey: string,
  name: string
): Promise<LoopProject> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
  } catch (err) {
    throw new NetworkError(err);
  }

  if (response.status === 401) throw new AuthError();
  if (!response.ok) throw new ApiError(response.status, await response.text());

  return response.json() as Promise<LoopProject>;
}
