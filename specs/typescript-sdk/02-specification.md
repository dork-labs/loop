---
slug: typescript-sdk
number: 13
created: 2026-02-23
status: specification
---

# TypeScript SDK — `@dork-labs/loop-sdk`

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-23
**Ideation:** [01-ideation.md](./01-ideation.md)
**Strategy:** [Agent Integration Strategy](../agent-integration-strategy.md) (Feature 4)

---

## Overview

Build two new monorepo packages: `@dork-labs/loop-types` (shared Zod-inferred type definitions) and `@dork-labs/loop-sdk` (idiomatic TypeScript client wrapping Loop's REST API). The SDK follows the Stripe/OpenAI class-based pattern with resource namespacing, providing `LoopClient` as the single entry point.

The SDK is the foundation for the Loop CLI (Feature 6) and will eventually replace the ad-hoc HTTP clients in the MCP server and dashboard app.

---

## Background / Problem Statement

Loop's API has three consumers today, each with its own HTTP client and type definitions:

1. **Dashboard app** (`apps/app/src/lib/api-client.ts`) — ky-based, types in `apps/app/src/types/`
2. **MCP server** (`packages/mcp/src/client.ts`) — ky-based, minimal types
3. **External agents** — raw HTTP calls with no type safety

This means:

- Types are duplicated and can drift from the API's Zod schemas
- Each consumer re-implements retry, error handling, and auth
- External developers have no official client — they must read API docs and construct HTTP calls manually
- The upcoming Loop CLI (Feature 6) would become a fourth consumer with yet another HTTP client

A shared types package and SDK solve all of these problems.

---

## Goals

- Ship `@dork-labs/loop-types` with Zod schemas as the single source of truth for all request/response types
- Ship `@dork-labs/loop-sdk` with full coverage of Loop's API surface (11 resource namespaces, ~35 methods)
- Provide `loop.dispatch.next()` as the SDK's signature method — Loop's core differentiator
- Support async generator pagination (`for await...of`) for agent workflows consuming large result sets
- Enable the Loop CLI (Feature 6) to be built entirely on the SDK
- Publish both packages to npm under `@dork-labs/` scope

---

## Non-Goals

- Agent-specific toolkit (`@loop/agent-toolkit`)
- CLI tool (Feature 6 — consumes this SDK)
- MCP server refactor to use SDK (follow-up work)
- Dashboard app refactor to use SDK (follow-up work)
- Auto-generation via Stainless/Fern/hey-api
- Python, Go, or other language SDKs
- Browser bundle (Node.js only for now)
- OAuth or session-based authentication
- Integration tests against a live API (unit tests with mocked responses)

---

## Technical Dependencies

| Dependency   | Version | Purpose                                                 |
| ------------ | ------- | ------------------------------------------------------- |
| `ky`         | ^1.14   | HTTP client with retry, hooks, timeout                  |
| `zod`        | ^3.24   | Schema definitions and type inference in packages/types |
| `tsup`       | ^8.0    | Dual ESM/CJS build                                      |
| `typescript` | ^5.7    | Type checking and declaration generation                |

---

## Detailed Design

### Package 1: `packages/types` — `@dork-labs/loop-types`

Shared Zod schemas extracted from the API. Every type consumed by the SDK, MCP server, or dashboard app originates here.

#### File Structure

```
packages/types/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts          # Barrel export
    ├── enums.ts          # Enum values and types
    ├── jsonb.ts          # JSONB field types (HypothesisData, CommitRef, etc.)
    ├── entities.ts       # Entity types (Issue, Project, Goal, etc.)
    ├── requests.ts       # Request body/query parameter types
    └── responses.ts      # Response envelope types
```

#### `src/enums.ts`

```typescript
import { z } from 'zod';

// Issue enums
export const issueTypeValues = ['signal', 'hypothesis', 'plan', 'task', 'monitor'] as const;
export const issueTypeSchema = z.enum(issueTypeValues);
export type IssueType = z.infer<typeof issueTypeSchema>;

export const issueStatusValues = [
  'triage',
  'backlog',
  'todo',
  'in_progress',
  'done',
  'canceled',
] as const;
export const issueStatusSchema = z.enum(issueStatusValues);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

// Relation enums
export const relationTypeValues = ['blocks', 'blocked_by', 'related', 'duplicate'] as const;
export const relationTypeSchema = z.enum(relationTypeValues);
export type RelationType = z.infer<typeof relationTypeSchema>;

// Author enums
export const authorTypeValues = ['human', 'agent'] as const;
export const authorTypeSchema = z.enum(authorTypeValues);
export type AuthorType = z.infer<typeof authorTypeSchema>;

// Project enums
export const projectStatusValues = [
  'backlog',
  'planned',
  'active',
  'paused',
  'completed',
  'canceled',
] as const;
export const projectStatusSchema = z.enum(projectStatusValues);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectHealthValues = ['on_track', 'at_risk', 'off_track'] as const;
export const projectHealthSchema = z.enum(projectHealthValues);
export type ProjectHealth = z.infer<typeof projectHealthSchema>;

// Goal enums
export const goalStatusValues = ['active', 'achieved', 'abandoned'] as const;
export const goalStatusSchema = z.enum(goalStatusValues);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

// Signal enums
export const signalSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export const signalSeveritySchema = z.enum(signalSeverityValues);
export type SignalSeverity = z.infer<typeof signalSeveritySchema>;

// Prompt version enums
export const versionStatusValues = ['active', 'draft', 'retired'] as const;
export const versionStatusSchema = z.enum(versionStatusValues);
export type VersionStatus = z.infer<typeof versionStatusSchema>;
```

#### `src/jsonb.ts`

```typescript
import { z } from 'zod';

export const hypothesisDataSchema = z.object({
  statement: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  validationCriteria: z.string(),
  prediction: z.string().optional(),
});
export type HypothesisData = z.infer<typeof hypothesisDataSchema>;

export const commitRefSchema = z.object({
  sha: z.string(),
  message: z.string(),
  url: z.string().optional(),
  author: z.string().optional(),
  timestamp: z.string().optional(),
});
export type CommitRef = z.infer<typeof commitRefSchema>;

export const pullRequestRefSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string().optional(),
  state: z.string().optional(),
  mergedAt: z.string().optional(),
});
export type PullRequestRef = z.infer<typeof pullRequestRefSchema>;

export type SignalPayload = Record<string, unknown>;

export const templateConditionsSchema = z
  .object({
    type: z.string().optional(),
    signalSource: z.string().optional(),
    labels: z.array(z.string()).optional(),
    projectId: z.string().optional(),
    hasFailedSessions: z.boolean().optional(),
    hypothesisConfidence: z.number().min(0).max(1).optional(),
  })
  .strict();
export type TemplateConditions = z.infer<typeof templateConditionsSchema>;
```

#### `src/entities.ts`

```typescript
export interface Issue {
  id: string;
  number: number;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: number;
  parentId: string | null;
  projectId: string | null;
  signalSource: string | null;
  signalPayload: SignalPayload | null;
  hypothesis: HypothesisData | null;
  agentSessionId: string | null;
  agentSummary: string | null;
  commits: CommitRef[] | null;
  pullRequests: PullRequestRef[] | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface IssueDetail extends Issue {
  parent: Issue | null;
  children: Issue[];
  labels: Label[];
  relations: IssueRelation[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProjectDetail extends Project {
  goal: Goal | null;
  issueCounts: Record<IssueStatus, number>;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  metric: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  status: GoalStatus;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface IssueRelation {
  id: string;
  type: RelationType;
  issueId: string;
  relatedIssueId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  body: string;
  issueId: string;
  authorName: string;
  authorType: AuthorType;
  parentId: string | null;
  createdAt: string;
}

export interface Signal {
  id: string;
  source: string;
  sourceId: string | null;
  type: string;
  severity: SignalSeverity;
  payload: SignalPayload;
  issueId: string;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  conditions: TemplateConditions;
  specificity: number;
  projectId: string | null;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  version: number;
  content: string;
  changelog: string | null;
  authorType: AuthorType;
  authorName: string;
  status: VersionStatus;
  usageCount: number;
  completionRate: number | null;
  avgDurationMs: number | null;
  reviewScore: number | null;
  createdAt: string;
}

export interface PromptReview {
  id: string;
  versionId: string;
  issueId: string;
  clarity: number;
  completeness: number;
  relevance: number;
  feedback: string | null;
  authorType: AuthorType;
  createdAt: string;
}
```

#### `src/requests.ts`

All request types mirror the exact Zod schemas from the API routes.

```typescript
// Issues
export interface CreateIssueParams {
  title: string;
  description?: string;
  type: IssueType;
  status?: IssueStatus;
  priority?: number; // 0-4
  parentId?: string;
  projectId?: string;
  signalSource?: string;
  signalPayload?: SignalPayload;
  hypothesis?: HypothesisData;
  labelIds?: string[];
}

export interface UpdateIssueParams {
  title?: string;
  description?: string;
  type?: IssueType;
  status?: IssueStatus;
  priority?: number;
  parentId?: string | null;
  projectId?: string | null;
  signalSource?: string;
  signalPayload?: SignalPayload;
  hypothesis?: HypothesisData | null;
}

export interface ListIssuesParams {
  status?: string; // comma-separated
  type?: string; // comma-separated
  projectId?: string;
  labelId?: string;
  priority?: number;
  parentId?: string;
  limit?: number; // 1-200, default 50
  offset?: number; // >= 0, default 0
}

// Projects
export interface CreateProjectParams {
  name: string;
  description?: string;
  status?: ProjectStatus;
  health?: ProjectHealth;
  goalId?: string;
}

export interface UpdateProjectParams {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  health?: ProjectHealth;
  goalId?: string | null;
}

// Goals
export interface CreateGoalParams {
  title: string;
  description?: string;
  metric?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  status?: GoalStatus;
  projectId?: string;
}

export interface UpdateGoalParams {
  title?: string;
  description?: string | null;
  metric?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  status?: GoalStatus;
  projectId?: string | null;
}

// Labels
export interface CreateLabelParams {
  name: string; // max 100, unique
  color: string; // max 50
}

// Signals
export interface IngestSignalParams {
  source: string;
  sourceId?: string;
  type: string;
  severity: SignalSeverity;
  payload: SignalPayload;
  projectId?: string;
}

// Comments
export interface CreateCommentParams {
  body: string;
  authorName: string;
  authorType: AuthorType;
  parentId?: string;
}

// Relations
export interface CreateRelationParams {
  type: RelationType;
  relatedIssueId: string;
}

// Templates
export interface CreateTemplateParams {
  slug: string;
  name: string;
  description?: string;
  conditions?: TemplateConditions;
  specificity?: number; // 0-100, default 10
  projectId?: string;
}

export interface UpdateTemplateParams {
  name?: string;
  description?: string;
  conditions?: TemplateConditions;
  specificity?: number;
  projectId?: string | null;
}

// Versions
export interface CreateVersionParams {
  content: string;
  changelog?: string;
  authorType: AuthorType;
  authorName: string;
}

// Reviews
export interface CreateReviewParams {
  versionId: string;
  issueId: string;
  clarity: number; // 1-5
  completeness: number; // 1-5
  relevance: number; // 1-5
  feedback?: string;
  authorType: AuthorType;
}

// Dispatch
export interface DispatchNextParams {
  projectId?: string;
}

export interface DispatchQueueParams {
  projectId?: string;
  limit?: number;
  offset?: number;
}

// Pagination (shared)
export interface PaginationParams {
  limit?: number; // 1-200, default 50
  offset?: number; // >= 0, default 0
}
```

#### `src/responses.ts`

```typescript
// Envelope types
export interface DataResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface ErrorResponse {
  error: string;
  details?: Record<string, unknown>;
}

// Dispatch-specific response
export interface DispatchNextResponse {
  issue: Pick<Issue, 'id' | 'number' | 'title' | 'type' | 'priority' | 'status'>;
  prompt: string | null;
  meta: {
    templateSlug: string;
    templateId: string;
    versionId: string;
    versionNumber: number;
    reviewUrl: string;
  } | null;
}

// Signal ingestion response
export interface SignalIngestResponse {
  signal: Signal;
  issue: Issue;
}

// Dashboard responses
export interface DashboardStats {
  issues: {
    total: number;
    byStatus: Record<IssueStatus, number>;
    byType: Record<IssueType, number>;
  };
  goals: {
    total: number;
    active: number;
    achieved: number;
  };
  dispatch: {
    queueDepth: number;
    activeCount: number;
    completedLast24h: number;
  };
}

export interface DashboardActivityItem {
  root: Issue;
  children: Array<{
    issue: Issue;
    relations: IssueRelation[];
  }>;
  latestActivity: string;
}

export interface DashboardPromptHealth {
  template: PromptTemplate;
  activeVersion: PromptVersion | null;
  recentVersions: PromptVersion[];
  reviewSummary: {
    totalReviews: number;
    avgClarity: number | null;
    avgCompleteness: number | null;
    avgRelevance: number | null;
    compositeScore: number | null;
  };
  needsAttention: boolean;
}

// Dispatch queue item
export interface DispatchQueueItem {
  issue: Issue;
  score: number;
  breakdown: {
    priorityWeight: number;
    goalBonus: number;
    ageBonus: number;
    typeBonus: number;
  };
}

// Template with active version
export interface TemplateDetail extends PromptTemplate {
  activeVersion: PromptVersion | null;
}

// Template preview
export interface TemplatePreview {
  issue: Pick<Issue, 'id' | 'number' | 'title' | 'type'>;
  template: PromptTemplate | null;
  version: Pick<PromptVersion, 'id' | 'version'> | null;
  prompt: string | null;
  message?: string;
}
```

---

### Package 2: `packages/sdk` — `@dork-labs/loop-sdk`

#### File Structure

```
packages/sdk/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts              # Barrel export
    ├── client.ts             # LoopClient class
    ├── http.ts               # ky-based HTTP layer
    ├── errors.ts             # Error class hierarchy
    ├── pagination.ts         # PaginatedList + async generator
    └── resources/
        ├── issues.ts
        ├── projects.ts
        ├── goals.ts
        ├── labels.ts
        ├── signals.ts
        ├── comments.ts
        ├── relations.ts
        ├── templates.ts
        ├── reviews.ts
        ├── dispatch.ts
        └── dashboard.ts
```

#### `src/client.ts` — LoopClient

```typescript
import type { Options } from 'ky';

export interface LoopClientOptions {
  apiKey: string;
  baseURL?: string; // default: 'http://localhost:5667'
  timeout?: number; // default: 30_000 ms
  maxRetries?: number; // default: 2
  retryStatusCodes?: number[]; // default: [429, 500, 503]
}

export class LoopClient {
  readonly issues: IssuesResource;
  readonly projects: ProjectsResource;
  readonly goals: GoalsResource;
  readonly labels: LabelsResource;
  readonly signals: SignalsResource;
  readonly comments: CommentsResource;
  readonly relations: RelationsResource;
  readonly templates: TemplatesResource;
  readonly reviews: ReviewsResource;
  readonly dispatch: DispatchResource;
  readonly dashboard: DashboardResource;

  constructor(options: LoopClientOptions) {
    const http = createHttpClient(options);
    this.issues = new IssuesResource(http);
    this.projects = new ProjectsResource(http);
    this.goals = new GoalsResource(http);
    this.labels = new LabelsResource(http);
    this.signals = new SignalsResource(http);
    this.comments = new CommentsResource(http);
    this.relations = new RelationsResource(http);
    this.templates = new TemplatesResource(http);
    this.reviews = new ReviewsResource(http);
    this.dispatch = new DispatchResource(http);
    this.dashboard = new DashboardResource(http);
  }
}
```

#### `src/http.ts` — HTTP Layer

```typescript
import ky, { type KyInstance } from 'ky';

export type HttpClient = KyInstance;

export function createHttpClient(options: LoopClientOptions): HttpClient {
  return ky.create({
    prefixUrl: options.baseURL ?? 'http://localhost:5667',
    timeout: options.timeout ?? 30_000,
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    retry: {
      limit: options.maxRetries ?? 2,
      statusCodes: options.retryStatusCodes ?? [429, 500, 503],
      backoffLimit: 10_000,
    },
    hooks: {
      beforeError: [
        async (error) => {
          // Transform ky HTTPError into typed LoopError subclasses
          // Strip Authorization header from error context
          const { response } = error;
          if (response) {
            const body = await response.json().catch(() => ({}));
            throw LoopError.fromResponse(response.status, body);
          }
          throw error;
        },
      ],
      beforeRequest: [
        (request, options) => {
          // Add idempotency key for mutating requests
          if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
            const key = options.headers?.get?.('Idempotency-Key') ?? crypto.randomUUID();
            request.headers.set('Idempotency-Key', key);
          }
        },
      ],
    },
  });
}
```

#### `src/errors.ts` — Error Hierarchy

```typescript
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

export class LoopNotFoundError extends LoopError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'LoopNotFoundError';
  }
}

export class LoopValidationError extends LoopError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, 'VALIDATION_ERROR', details);
    this.name = 'LoopValidationError';
  }
}

export class LoopConflictError extends LoopError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'LoopConflictError';
  }
}

export class LoopRateLimitError extends LoopError {
  constructor(message: string) {
    super(message, 429, 'RATE_LIMITED');
    this.name = 'LoopRateLimitError';
  }
}
```

#### `src/pagination.ts` — Pagination

```typescript
export class PaginatedList<T> {
  readonly data: T[];
  readonly total: number;

  constructor(data: T[], total: number) {
    this.data = data;
    this.total = total;
  }

  get hasMore(): boolean {
    return this.data.length > 0 && this.data.length < this.total;
  }
}

/**
 * Creates an async generator that auto-paginates through all results.
 * Yields individual items, not pages.
 *
 * Usage:
 *   for await (const issue of loop.issues.iter({ status: 'todo' })) {
 *     console.log(issue.title)
 *   }
 */
export async function* paginate<T, P extends { limit?: number; offset?: number }>(
  fetchPage: (params: P) => Promise<PaginatedList<T>>,
  params: P,
  pageSize: number = 50
): AsyncGenerator<T, void, undefined> {
  let offset = params.offset ?? 0;

  while (true) {
    const page = await fetchPage({ ...params, limit: pageSize, offset });

    for (const item of page.data) {
      yield item;
    }

    offset += page.data.length;

    if (page.data.length < pageSize || offset >= page.total) {
      break;
    }
  }
}
```

#### Resource Class Pattern

Each resource class follows this pattern:

```typescript
export class IssuesResource {
  constructor(private readonly http: HttpClient) {}

  async list(params?: ListIssuesParams): Promise<PaginatedList<Issue>> {
    const searchParams = toSearchParams(params);
    const response = await this.http
      .get('api/issues', { searchParams })
      .json<PaginatedResponse<Issue>>();
    return new PaginatedList(response.data, response.total);
  }

  iter(params?: Omit<ListIssuesParams, 'limit' | 'offset'>): AsyncGenerator<Issue> {
    return paginate((p) => this.list({ ...params, ...p }), params ?? {});
  }

  async get(id: string): Promise<IssueDetail> {
    const response = await this.http.get(`api/issues/${id}`).json<DataResponse<IssueDetail>>();
    return response.data;
  }

  async create(params: CreateIssueParams, options?: RequestOptions): Promise<Issue> {
    const response = await this.http
      .post('api/issues', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Issue>>();
    return response.data;
  }

  async update(id: string, params: UpdateIssueParams, options?: RequestOptions): Promise<Issue> {
    const response = await this.http
      .patch(`api/issues/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Issue>>();
    return response.data;
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/issues/${id}`, toKyOptions(options));
  }
}
```

#### `src/resources/dispatch.ts` — Loop's Signature Resource

```typescript
export class DispatchResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Atomically claim the highest-priority unblocked issue.
   * Returns the issue with hydrated prompt instructions, or null if queue is empty.
   *
   * This is Loop's core method — it closes the agent feedback loop.
   */
  async next(params?: DispatchNextParams): Promise<DispatchNextResponse | null> {
    const searchParams = toSearchParams(params);
    const response = await this.http.get('api/dispatch/next', { searchParams });

    if (response.status === 204) {
      return null;
    }

    const body = await response.json<DataResponse<DispatchNextResponse>>();
    return body.data;
  }

  /**
   * Preview the priority queue without claiming any issues.
   */
  async queue(params?: DispatchQueueParams): Promise<PaginatedList<DispatchQueueItem>> {
    const searchParams = toSearchParams(params);
    const response = await this.http
      .get('api/dispatch/queue', { searchParams })
      .json<PaginatedResponse<DispatchQueueItem>>();
    return new PaginatedList(response.data, response.total);
  }
}
```

#### All Resource Methods (Complete API Coverage)

| Resource                              | Method | HTTP                                       | Endpoint                                                  |
| ------------------------------------- | ------ | ------------------------------------------ | --------------------------------------------------------- |
| `issues.list(params?)`                | GET    | `/api/issues`                              | Filterable + paginated                                    |
| `issues.iter(params?)`                | GET    | `/api/issues`                              | Auto-paginating generator                                 |
| `issues.get(id)`                      | GET    | `/api/issues/:id`                          | Returns IssueDetail with parent/children/labels/relations |
| `issues.create(params)`               | POST   | `/api/issues`                              | Returns Issue                                             |
| `issues.update(id, params)`           | PATCH  | `/api/issues/:id`                          | Returns Issue                                             |
| `issues.delete(id)`                   | DELETE | `/api/issues/:id`                          | Soft-delete                                               |
| `projects.list(params?)`              | GET    | `/api/projects`                            | Paginated                                                 |
| `projects.iter(params?)`              | GET    | `/api/projects`                            | Auto-paginating generator                                 |
| `projects.get(id)`                    | GET    | `/api/projects/:id`                        | Returns ProjectDetail with goal + issueCounts             |
| `projects.create(params)`             | POST   | `/api/projects`                            | Returns Project                                           |
| `projects.update(id, params)`         | PATCH  | `/api/projects/:id`                        | Returns Project                                           |
| `projects.delete(id)`                 | DELETE | `/api/projects/:id`                        | Soft-delete                                               |
| `goals.list(params?)`                 | GET    | `/api/goals`                               | Paginated                                                 |
| `goals.iter(params?)`                 | GET    | `/api/goals`                               | Auto-paginating generator                                 |
| `goals.get(id)`                       | GET    | `/api/goals/:id`                           | Returns Goal                                              |
| `goals.create(params)`                | POST   | `/api/goals`                               | Returns Goal                                              |
| `goals.update(id, params)`            | PATCH  | `/api/goals/:id`                           | Returns Goal                                              |
| `goals.delete(id)`                    | DELETE | `/api/goals/:id`                           | Soft-delete                                               |
| `labels.list(params?)`                | GET    | `/api/labels`                              | Paginated                                                 |
| `labels.iter(params?)`                | GET    | `/api/labels`                              | Auto-paginating generator                                 |
| `labels.create(params)`               | POST   | `/api/labels`                              | Returns Label                                             |
| `labels.delete(id)`                   | DELETE | `/api/labels/:id`                          | Soft-delete                                               |
| `signals.ingest(params)`              | POST   | `/api/signals`                             | Returns SignalIngestResponse                              |
| `comments.list(issueId)`              | GET    | `/api/issues/:id/comments`                 | Returns Comment[]                                         |
| `comments.create(issueId, params)`    | POST   | `/api/issues/:id/comments`                 | Returns Comment                                           |
| `relations.create(issueId, params)`   | POST   | `/api/issues/:id/relations`                | Returns IssueRelation                                     |
| `relations.delete(id)`                | DELETE | `/api/relations/:id`                       | Hard-delete                                               |
| `templates.list(params?)`             | GET    | `/api/templates`                           | Paginated                                                 |
| `templates.iter(params?)`             | GET    | `/api/templates`                           | Auto-paginating generator                                 |
| `templates.get(id)`                   | GET    | `/api/templates/:id`                       | Returns TemplateDetail with activeVersion                 |
| `templates.create(params)`            | POST   | `/api/templates`                           | Returns PromptTemplate                                    |
| `templates.update(id, params)`        | PATCH  | `/api/templates/:id`                       | Returns PromptTemplate                                    |
| `templates.delete(id)`                | DELETE | `/api/templates/:id`                       | Soft-delete                                               |
| `templates.preview(issueId)`          | GET    | `/api/templates/preview/:issueId`          | Returns TemplatePreview                                   |
| `templates.versions(id, params?)`     | GET    | `/api/templates/:id/versions`              | Paginated versions                                        |
| `templates.createVersion(id, params)` | POST   | `/api/templates/:id/versions`              | Returns PromptVersion                                     |
| `templates.promote(id, versionId)`    | POST   | `/api/templates/:id/versions/:vId/promote` | Returns PromptVersion                                     |
| `reviews.create(params)`              | POST   | `/api/prompt-reviews`                      | Returns PromptReview                                      |
| `reviews.list(templateId, params?)`   | GET    | `/api/templates/:id/reviews`               | Paginated reviews                                         |
| `dispatch.next(params?)`              | GET    | `/api/dispatch/next`                       | Returns DispatchNextResponse or null                      |
| `dispatch.queue(params?)`             | GET    | `/api/dispatch/queue`                      | Returns PaginatedList<DispatchQueueItem>                  |
| `dashboard.stats()`                   | GET    | `/api/dashboard/stats`                     | Returns DashboardStats                                    |
| `dashboard.activity(params?)`         | GET    | `/api/dashboard/activity`                  | Returns DashboardActivityItem[]                           |
| `dashboard.prompts()`                 | GET    | `/api/dashboard/prompts`                   | Returns DashboardPromptHealth[]                           |

#### `RequestOptions` — Per-Request Overrides

```typescript
export interface RequestOptions {
  idempotencyKey?: string; // Override auto-generated key
  timeout?: number; // Override default timeout
  signal?: AbortSignal; // Cancellation support
}
```

---

### Build Configuration

#### `packages/types/tsup.config.ts`

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

#### `packages/sdk/tsup.config.ts`

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@dork-labs/loop-types'],
});
```

#### `packages/types/package.json`

```json
{
  "name": "@dork-labs/loop-types",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.7.0"
  }
}
```

#### `packages/sdk/package.json`

```json
{
  "name": "@dork-labs/loop-sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@dork-labs/loop-types": "workspace:*",
    "ky": "^1.14.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.7.0"
  }
}
```

### Monorepo Integration

**Root `tsconfig.json`** — add project references:

```json
{
  "references": [
    { "path": "packages/types" },
    { "path": "packages/sdk" }
    // ... existing references
  ]
}
```

**`turbo.json`** — ensure correct build ordering:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

The `^build` dependency ensures `packages/types` builds before `packages/sdk` (since SDK depends on types).

---

## User Experience

### For Agent Developers (Primary Persona)

```typescript
import { LoopClient } from '@dork-labs/loop-sdk';

const loop = new LoopClient({
  apiKey: process.env.LOOP_API_KEY!,
  baseURL: 'https://api.looped.me',
});

// The agent dispatch loop
while (true) {
  const task = await loop.dispatch.next();
  if (!task) {
    await sleep(60_000); // No work available
    continue;
  }

  console.log(`Working on: #${task.issue.number} ${task.issue.title}`);
  console.log(`Instructions:\n${task.prompt}`);

  // ... agent does work ...

  // Report completion
  await loop.issues.update(task.issue.id, { status: 'done' });
  await loop.comments.create(task.issue.id, {
    body: 'Completed: deployed fix to production',
    authorName: 'my-agent',
    authorType: 'agent',
  });

  // Submit prompt feedback
  if (task.meta) {
    await loop.reviews.create({
      versionId: task.meta.versionId,
      issueId: task.issue.id,
      clarity: 5,
      completeness: 4,
      relevance: 5,
      authorType: 'agent',
    });
  }
}
```

### For CLI Developers (Feature 6)

```typescript
// The CLI's `loop next` command
const task = await loop.dispatch.next();
if (!task) {
  console.log('No tasks in queue');
  process.exit(0);
}

// Render to terminal with formatting
renderTask(task);
```

### Error Handling

```typescript
try {
  await loop.issues.get('nonexistent-id');
} catch (error) {
  if (error instanceof LoopNotFoundError) {
    console.log('Issue not found');
  } else if (error instanceof LoopValidationError) {
    console.log('Validation failed:', error.details);
  } else if (error instanceof LoopRateLimitError) {
    console.log('Rate limited, retrying...');
  }
}
```

---

## Testing Strategy

### Unit Tests (packages/sdk)

Tests use Vitest with mocked HTTP responses. No live API required.

```
packages/sdk/src/__tests__/
├── client.test.ts         # LoopClient construction and options
├── http.test.ts           # HTTP layer: retry, auth headers, timeout, idempotency
├── errors.test.ts         # Error class construction and fromResponse()
├── pagination.test.ts     # PaginatedList + async generator behavior
└── resources/
    ├── issues.test.ts     # Issues resource methods
    ├── dispatch.test.ts   # Dispatch.next() with 200 and 204 responses
    ├── signals.test.ts    # Signal ingestion
    └── ...                # One test file per resource
```

**Key test scenarios:**

1. **Client construction** — validates apiKey required, defaults applied, custom options preserved
2. **Auth header** — every request includes `Authorization: Bearer <key>`
3. **Retry behavior** — retries on 429/500/503, does not retry on 400/404/422
4. **Idempotency keys** — auto-generated on POST/PATCH/DELETE, not on GET, custom key override works
5. **Error mapping** — 404 → LoopNotFoundError, 422 → LoopValidationError, 429 → LoopRateLimitError
6. **API key scrubbing** — Authorization header never appears in error objects
7. **Pagination** — `iter()` fetches multiple pages, stops at end, handles empty results
8. **Dispatch.next() with 204** — returns null (not an error) when queue is empty
9. **Dispatch.next() with 200** — returns typed DispatchNextResponse

### Unit Tests (packages/types)

Minimal — types are validated by the TypeScript compiler. Tests verify:

1. Zod schema parsing for valid/invalid inputs
2. Type inference produces correct TypeScript types
3. Enum arrays contain expected values

---

## Performance Considerations

- **ky** adds ~4.7KB gzipped — acceptable for a server-side SDK
- Default 2 retries with exponential backoff: worst-case ~3s added latency before error surfaces
- `iter()` fetches pages lazily — only loads data as consumed by the generator
- 30s default timeout prevents hung connections
- No `listAll()` method — prevents accidental memory exhaustion on unbounded collections

---

## Security Considerations

- **API key scrubbing**: Authorization header stripped from all error objects and stack traces
- **No key-in-URL**: API key only sent via Authorization header, never as query parameter
- **Idempotency key entropy**: Uses `crypto.randomUUID()` (not `Math.random()`)
- **HTTPS warning**: Log warning if baseURL uses `http://` on non-localhost
- **Browser exposure**: Document that using the SDK in a browser exposes the API key client-side

---

## Documentation

- README.md in `packages/sdk/` with quickstart, API reference summary, and error handling
- README.md in `packages/types/` explaining the shared types package
- JSDoc comments on all public methods and types
- Update root CLAUDE.md to add packages/types and packages/sdk to the monorepo structure table

---

## Implementation Phases

### Phase 1: Shared Types Package

1. Create `packages/types/` with package.json, tsconfig.json, tsup.config.ts
2. Write `src/enums.ts` — all enum values and Zod schemas
3. Write `src/jsonb.ts` — JSONB field type schemas
4. Write `src/entities.ts` — entity interfaces
5. Write `src/requests.ts` — request parameter types
6. Write `src/responses.ts` — response envelope types
7. Write `src/index.ts` — barrel export
8. Verify `npm run build` and `npm run typecheck` pass

### Phase 2: SDK Core Infrastructure

1. Create `packages/sdk/` with package.json, tsconfig.json, tsup.config.ts
2. Write `src/errors.ts` — error class hierarchy
3. Write `src/http.ts` — ky-based HTTP client with retry, auth, idempotency
4. Write `src/pagination.ts` — PaginatedList class and async generator
5. Write unit tests for errors, http, pagination
6. Update root tsconfig.json and turbo.json

### Phase 3: Resource Classes

1. Write `src/resources/dispatch.ts` — Loop's signature resource (ship first)
2. Write `src/resources/issues.ts` — full CRUD + iter
3. Write `src/resources/projects.ts`, `goals.ts`, `labels.ts` — standard CRUD
4. Write `src/resources/signals.ts` — ingest only
5. Write `src/resources/comments.ts`, `relations.ts` — issue sub-resources
6. Write `src/resources/templates.ts` — CRUD + versions + promote + preview
7. Write `src/resources/reviews.ts` — create + list
8. Write `src/resources/dashboard.ts` — stats, activity, prompts
9. Write `src/client.ts` — LoopClient wiring all resources
10. Write `src/index.ts` — barrel export
11. Write unit tests for each resource

### Phase 4: Polish

1. Add JSDoc comments to all public APIs
2. Write README.md for both packages
3. Verify full `npm run build`, `npm run typecheck`, `npm test` pass
4. Test npm pack for both packages to verify publish readiness

---

## Open Questions

None — all decisions resolved during ideation.

---

## Related ADRs

| ADR                                               | Relevance                               |
| ------------------------------------------------- | --------------------------------------- |
| ADR#18 — Use zod-to-openapi for API docs          | Types package uses the same Zod schemas |
| ADR#20 — Use raw Zod for env validation           | Consistent Zod usage pattern            |
| ADR#23 — Use loop\_ prefix for API keys           | SDK validates key format                |
| ADR#25 — Dual transport MCP package               | SDK follows similar package structure   |
| ADR#28 — Content-only npm package for agent skill | Package publishing patterns             |

---

## References

- [Ideation document](./01-ideation.md)
- [Agent Integration Strategy](../agent-integration-strategy.md) — Feature 4
- [SDK/CLI Research](../../research/20260222_sdk_cli_api_interaction_layers.md)
- [SDK Design Research](../../research/20260223_typescript_sdk_design.md)
- [stripe-node architecture](https://github.com/stripe/stripe-node)
- [openai-node architecture](https://github.com/openai/openai-node)
