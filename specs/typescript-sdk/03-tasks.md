---
slug: typescript-sdk
number: 13
created: 2026-02-23
status: tasks
---

# TypeScript SDK — Implementation Tasks

**Spec**: [02-specification.md](./02-specification.md)
**Total Tasks**: 14
**Phases**: 4

---

## Phase 1: Shared Types Package (Foundation)

### Task 1: [P1] Create `packages/types` package scaffolding and enums

Create the `packages/types/` directory with all configuration files and the `src/enums.ts` module.

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

#### `packages/types/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

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

#### `packages/types/src/enums.ts`

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

Run `npm install` from the repo root after creating the package.json.

#### Acceptance Criteria

- [ ] `packages/types/` directory exists with all 4 config files
- [ ] `src/enums.ts` contains all 9 enum definitions matching the API schema
- [ ] Enum values exactly match those in `apps/api/src/db/schema/issues.ts`, `projects.ts`, `signals.ts`, `prompts.ts`
- [ ] `npm install` succeeds from repo root
- [ ] TypeScript compiles `src/enums.ts` with no errors

**Blocked by**: Nothing (first task)

---

### Task 2: [P1] Create JSONB field types and entity interfaces

Create `packages/types/src/jsonb.ts` with Zod schemas for all JSONB field types, and `packages/types/src/entities.ts` with all entity interfaces.

#### `packages/types/src/jsonb.ts`

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

#### `packages/types/src/entities.ts`

```typescript
import type {
  IssueType,
  IssueStatus,
  ProjectStatus,
  ProjectHealth,
  GoalStatus,
  SignalSeverity,
  RelationType,
  AuthorType,
  VersionStatus,
} from './enums';
import type {
  HypothesisData,
  CommitRef,
  PullRequestRef,
  SignalPayload,
  TemplateConditions,
} from './jsonb';

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

#### Acceptance Criteria

- [ ] `src/jsonb.ts` has all 5 Zod schemas/types matching the API's JSONB column types
- [ ] `src/entities.ts` has all 12 entity interfaces with correct field types
- [ ] All types match the DB schema in `apps/api/src/db/schema/`
- [ ] TypeScript compiles both files with no errors

**Blocked by**: Task 1 (needs enums.ts)

---

### Task 3: [P1] Create request types, response types, and barrel export

Create `packages/types/src/requests.ts`, `packages/types/src/responses.ts`, and `packages/types/src/index.ts` barrel export. Verify the full package builds.

#### `packages/types/src/requests.ts`

```typescript
import type {
  IssueType,
  IssueStatus,
  ProjectStatus,
  ProjectHealth,
  GoalStatus,
  SignalSeverity,
  AuthorType,
  RelationType,
  VersionStatus,
} from './enums';
import type { HypothesisData, SignalPayload, TemplateConditions } from './jsonb';

// Issues
export interface CreateIssueParams {
  title: string;
  description?: string;
  type: IssueType;
  status?: IssueStatus;
  priority?: number;
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
  status?: string;
  type?: string;
  projectId?: string;
  labelId?: string;
  priority?: number;
  parentId?: string;
  limit?: number;
  offset?: number;
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
  name: string;
  color: string;
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
  specificity?: number;
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
  clarity: number;
  completeness: number;
  relevance: number;
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
  limit?: number;
  offset?: number;
}
```

#### `packages/types/src/responses.ts`

```typescript
import type { Issue, IssueRelation, Signal, PromptTemplate, PromptVersion, Goal } from './entities';
import type { IssueStatus, IssueType } from './enums';

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

#### `packages/types/src/index.ts`

```typescript
// Enums
export {
  issueTypeValues,
  issueTypeSchema,
  type IssueType,
  issueStatusValues,
  issueStatusSchema,
  type IssueStatus,
  relationTypeValues,
  relationTypeSchema,
  type RelationType,
  authorTypeValues,
  authorTypeSchema,
  type AuthorType,
  projectStatusValues,
  projectStatusSchema,
  type ProjectStatus,
  projectHealthValues,
  projectHealthSchema,
  type ProjectHealth,
  goalStatusValues,
  goalStatusSchema,
  type GoalStatus,
  signalSeverityValues,
  signalSeveritySchema,
  type SignalSeverity,
  versionStatusValues,
  versionStatusSchema,
  type VersionStatus,
} from './enums';

// JSONB types
export {
  hypothesisDataSchema,
  type HypothesisData,
  commitRefSchema,
  type CommitRef,
  pullRequestRefSchema,
  type PullRequestRef,
  type SignalPayload,
  templateConditionsSchema,
  type TemplateConditions,
} from './jsonb';

// Entity interfaces
export type {
  Issue,
  IssueDetail,
  Project,
  ProjectDetail,
  Goal,
  Label,
  IssueRelation,
  Comment,
  Signal,
  PromptTemplate,
  PromptVersion,
  PromptReview,
} from './entities';

// Request types
export type {
  CreateIssueParams,
  UpdateIssueParams,
  ListIssuesParams,
  CreateProjectParams,
  UpdateProjectParams,
  CreateGoalParams,
  UpdateGoalParams,
  CreateLabelParams,
  IngestSignalParams,
  CreateCommentParams,
  CreateRelationParams,
  CreateTemplateParams,
  UpdateTemplateParams,
  CreateVersionParams,
  CreateReviewParams,
  DispatchNextParams,
  DispatchQueueParams,
  PaginationParams,
} from './requests';

// Response types
export type {
  DataResponse,
  PaginatedResponse,
  ErrorResponse,
  DispatchNextResponse,
  SignalIngestResponse,
  DashboardStats,
  DashboardActivityItem,
  DashboardPromptHealth,
  DispatchQueueItem,
  TemplateDetail,
  TemplatePreview,
} from './responses';
```

After creating all files, run from the repo root:

```bash
cd packages/types && npm run build && npm run typecheck
```

#### Acceptance Criteria

- [ ] `src/requests.ts` has all 16 request parameter interfaces
- [ ] `src/responses.ts` has all 11 response types
- [ ] `src/index.ts` re-exports everything from all 4 modules
- [ ] `npm run build` in `packages/types/` succeeds, producing `dist/` with `.js`, `.cjs`, `.d.ts` files
- [ ] `npm run typecheck` passes with no errors

**Blocked by**: Task 2 (needs entities and jsonb)

---

## Phase 2: SDK Core Infrastructure

### Task 4: [P2] Create `packages/sdk` package scaffolding

Create the `packages/sdk/` directory with all configuration files.

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
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@dork-labs/loop-types": "workspace:*",
    "ky": "^1.14.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2"
  }
}
```

#### `packages/sdk/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
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

Create a placeholder `packages/sdk/src/index.ts`:

```typescript
export {};
```

Run `npm install` from the repo root after creating the package.json.

#### Acceptance Criteria

- [ ] `packages/sdk/` directory exists with all 3 config files
- [ ] `npm install` succeeds from repo root (workspace link to types resolves)
- [ ] Placeholder `src/index.ts` exists

**Blocked by**: Task 3 (types package must build first since SDK depends on it)

---

### Task 5: [P2] Implement error class hierarchy

Create `packages/sdk/src/errors.ts` with `LoopError` base class and typed subclasses.

#### `packages/sdk/src/errors.ts`

```typescript
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
```

#### `packages/sdk/src/__tests__/errors.test.ts`

```typescript
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
```

#### Acceptance Criteria

- [ ] `LoopError` base class with `status`, `code`, `details` properties
- [ ] `fromResponse()` static factory maps 404/409/422/429 to typed subclasses
- [ ] Unknown status codes produce base `LoopError` with `HTTP_{status}` code
- [ ] All error classes extend `Error` and have correct `name` property
- [ ] Unit tests pass: `npx vitest run packages/sdk/src/__tests__/errors.test.ts`

**Blocked by**: Task 4 (SDK scaffolding)

---

### Task 6: [P2] Implement HTTP client layer

Create `packages/sdk/src/http.ts` with ky-based HTTP client factory.

#### `packages/sdk/src/http.ts`

```typescript
import ky, { type KyInstance } from 'ky';
import { LoopError } from './errors';

export type HttpClient = KyInstance;

export interface LoopClientOptions {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  retryStatusCodes?: number[];
}

/** Per-request overrides for mutating operations. */
export interface RequestOptions {
  idempotencyKey?: string;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Create a ky HTTP client pre-configured with auth, retry, and error mapping.
 *
 * @param options - Client configuration
 */
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
          const { response } = error;
          if (response) {
            const body = await response.json().catch(() => ({}));
            throw LoopError.fromResponse(response.status, body as Record<string, unknown>);
          }
          throw error;
        },
      ],
      beforeRequest: [
        (request) => {
          // Add idempotency key for mutating requests
          if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
            if (!request.headers.has('Idempotency-Key')) {
              request.headers.set('Idempotency-Key', crypto.randomUUID());
            }
          }
        },
      ],
    },
  });
}

/**
 * Convert RequestOptions to ky-compatible options.
 *
 * @param options - Per-request overrides
 */
export function toKyOptions(options?: RequestOptions): Record<string, unknown> {
  if (!options) return {};
  const result: Record<string, unknown> = {};
  if (options.timeout) result.timeout = options.timeout;
  if (options.signal) result.signal = options.signal;
  if (options.idempotencyKey) {
    result.headers = { 'Idempotency-Key': options.idempotencyKey };
  }
  return result;
}

/**
 * Convert an object of params to URLSearchParams, omitting undefined values.
 *
 * @param params - Query parameters object
 */
export function toSearchParams(params?: Record<string, unknown>): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (!params) return searchParams;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
  return searchParams;
}
```

#### `packages/sdk/src/__tests__/http.test.ts`

Write tests that verify:

1. `createHttpClient` returns a ky instance with the correct prefixUrl
2. Auth header is set to `Bearer <apiKey>`
3. Default timeout is 30000ms
4. Default retry limit is 2 with status codes [429, 500, 503]
5. Custom options override defaults
6. `toSearchParams` omits undefined/null values and converts others to strings
7. `toKyOptions` maps idempotencyKey to headers, timeout, and signal

Use `vi.mock('ky')` to mock the ky module and verify `ky.create` is called with the expected options.

#### Acceptance Criteria

- [ ] `createHttpClient()` produces a configured ky instance with auth, retry, error mapping, and idempotency
- [ ] `toKyOptions()` converts `RequestOptions` to ky-compatible options
- [ ] `toSearchParams()` converts params objects to URLSearchParams, omitting undefined
- [ ] `beforeError` hook transforms ky HTTPError into `LoopError` subclasses
- [ ] `beforeRequest` hook adds `Idempotency-Key` for POST/PATCH/DELETE, not for GET
- [ ] Unit tests pass

**Blocked by**: Task 5 (needs errors.ts)

---

### Task 7: [P2] Implement pagination utilities

Create `packages/sdk/src/pagination.ts` with `PaginatedList` class and async generator.

#### `packages/sdk/src/pagination.ts`

````typescript
/**
 * Wrapper around paginated API responses.
 * Provides `hasMore` to check if additional pages exist.
 */
export class PaginatedList<T> {
  readonly data: T[];
  readonly total: number;

  constructor(data: T[], total: number) {
    this.data = data;
    this.total = total;
  }

  /** Whether more results exist beyond the current page. */
  get hasMore(): boolean {
    return this.data.length > 0 && this.data.length < this.total;
  }
}

/**
 * Creates an async generator that auto-paginates through all results.
 * Yields individual items, not pages.
 *
 * @param fetchPage - Function that fetches a single page of results
 * @param params - Base query parameters (limit/offset will be overridden)
 * @param pageSize - Number of items per page (default 50)
 *
 * @example
 * ```typescript
 * for await (const issue of loop.issues.iter({ status: 'todo' })) {
 *   console.log(issue.title)
 * }
 * ```
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
````

#### `packages/sdk/src/__tests__/pagination.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PaginatedList, paginate } from '../pagination';

describe('PaginatedList', () => {
  it('stores data and total', () => {
    const list = new PaginatedList([1, 2, 3], 10);
    expect(list.data).toEqual([1, 2, 3]);
    expect(list.total).toBe(10);
  });

  it('hasMore is true when data.length < total', () => {
    expect(new PaginatedList([1, 2], 5).hasMore).toBe(true);
  });

  it('hasMore is false when data.length equals total', () => {
    expect(new PaginatedList([1, 2, 3], 3).hasMore).toBe(false);
  });

  it('hasMore is false for empty results', () => {
    expect(new PaginatedList([], 0).hasMore).toBe(false);
  });
});

describe('paginate', () => {
  it('yields all items across multiple pages', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(new PaginatedList(['a', 'b'], 5))
      .mockResolvedValueOnce(new PaginatedList(['c', 'd'], 5))
      .mockResolvedValueOnce(new PaginatedList(['e'], 5));

    const items: string[] = [];
    for await (const item of paginate(fetchPage, {}, 2)) {
      items.push(item);
    }

    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenCalledWith({ limit: 2, offset: 0 });
    expect(fetchPage).toHaveBeenCalledWith({ limit: 2, offset: 2 });
    expect(fetchPage).toHaveBeenCalledWith({ limit: 2, offset: 4 });
  });

  it('stops when page returns fewer items than pageSize', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(new PaginatedList(['a'], 1));

    const items: string[] = [];
    for await (const item of paginate(fetchPage, {}, 2)) {
      items.push(item);
    }

    expect(items).toEqual(['a']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('handles empty result', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(new PaginatedList([], 0));

    const items: string[] = [];
    for await (const item of paginate(fetchPage, {}, 50)) {
      items.push(item);
    }

    expect(items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('respects initial offset from params', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(new PaginatedList(['c'], 3));

    const items: string[] = [];
    for await (const item of paginate(fetchPage, { offset: 2 }, 2)) {
      items.push(item);
    }

    expect(items).toEqual(['c']);
    expect(fetchPage).toHaveBeenCalledWith({ limit: 2, offset: 2 });
  });
});
```

#### Acceptance Criteria

- [ ] `PaginatedList` class wraps `data` and `total` with `hasMore` computed property
- [ ] `paginate()` async generator fetches pages lazily and yields individual items
- [ ] Generator stops when `page.data.length < pageSize` or `offset >= page.total`
- [ ] Generator respects initial `offset` from params
- [ ] Empty results handled gracefully (single fetch, no items yielded)
- [ ] Unit tests pass

**Blocked by**: Task 4 (SDK scaffolding)

---

### Task 8: [P2] Update monorepo configuration for new packages

Update root `tsconfig.json` and `vitest.workspace.ts` to include the new packages.

#### Root `tsconfig.json` — add references

Add to the `references` array:

```json
{ "path": "./packages/types" },
{ "path": "./packages/sdk" }
```

The full references array should be:

```json
"references": [
  { "path": "./apps/api" },
  { "path": "./apps/app" },
  { "path": "./apps/cli" },
  { "path": "./apps/web" },
  { "path": "./packages/mcp" },
  { "path": "./packages/types" },
  { "path": "./packages/sdk" }
]
```

#### `vitest.workspace.ts` — add workspaces

Add `'packages/types'` and `'packages/sdk'` to the workspace array:

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/api',
  'apps/app',
  'apps/cli',
  'apps/web',
  'packages/mcp',
  'packages/loop-skill',
  'packages/types',
  'packages/sdk',
]);
```

Note: `turbo.json` already has `"dependsOn": ["^build"]` which ensures correct build ordering automatically.

#### Acceptance Criteria

- [ ] Root `tsconfig.json` references both `packages/types` and `packages/sdk`
- [ ] `vitest.workspace.ts` includes both new packages
- [ ] `npm run build` from root builds types before sdk (verify with Turborepo output)
- [ ] `npm run typecheck` from root includes both packages

**Blocked by**: Task 4 (packages must exist first)

---

## Phase 3: Resource Classes

### Task 9: [P3] Implement dispatch and signals resources

Create Loop's signature dispatch resource and the signals ingestion resource, plus unit tests.

#### `packages/sdk/src/resources/dispatch.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams } from '../http';
import { PaginatedList } from '../pagination';
import type {
  DispatchNextParams,
  DispatchQueueParams,
  DataResponse,
  PaginatedResponse,
  DispatchNextResponse,
  DispatchQueueItem,
} from '@dork-labs/loop-types';

/**
 * Dispatch resource — Loop's core agent feedback loop.
 * Claim work from the priority queue with hydrated prompt instructions.
 */
export class DispatchResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Atomically claim the highest-priority unblocked issue.
   * Returns the issue with hydrated prompt instructions, or null if queue is empty.
   *
   * @param params - Optional filter by projectId
   */
  async next(params?: DispatchNextParams): Promise<DispatchNextResponse | null> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http.get('api/dispatch/next', { searchParams });

    if (response.status === 204) {
      return null;
    }

    const body = await response.json<DataResponse<DispatchNextResponse>>();
    return body.data;
  }

  /**
   * Preview the priority queue without claiming any issues.
   *
   * @param params - Optional filter and pagination
   */
  async queue(params?: DispatchQueueParams): Promise<PaginatedList<DispatchQueueItem>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/dispatch/queue', { searchParams })
      .json<PaginatedResponse<DispatchQueueItem>>();
    return new PaginatedList(response.data, response.total);
  }
}
```

#### `packages/sdk/src/resources/signals.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toKyOptions } from '../http';
import type { IngestSignalParams, DataResponse, SignalIngestResponse } from '@dork-labs/loop-types';

/**
 * Signals resource — ingest external data (PostHog, GitHub, Sentry, etc.)
 * into the Loop feedback pipeline.
 */
export class SignalsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Ingest a signal. Creates a signal record and a linked triage issue.
   *
   * @param params - Signal data including source, type, severity, and payload
   * @param options - Per-request overrides
   */
  async ingest(
    params: IngestSignalParams,
    options?: RequestOptions
  ): Promise<SignalIngestResponse> {
    const response = await this.http
      .post('api/signals', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<SignalIngestResponse>>();
    return response.data;
  }
}
```

#### Unit Tests

Write `packages/sdk/src/__tests__/resources/dispatch.test.ts` and `signals.test.ts`:

**dispatch.test.ts** key scenarios:

- `next()` with 200 returns typed `DispatchNextResponse`
- `next()` with 204 returns `null`
- `next()` passes `projectId` as search param
- `queue()` returns `PaginatedList<DispatchQueueItem>`
- `queue()` passes limit/offset/projectId as search params

**signals.test.ts** key scenarios:

- `ingest()` POSTs to `api/signals` with JSON body
- `ingest()` returns `SignalIngestResponse` with both signal and issue
- `ingest()` passes through `RequestOptions`

Mock the HTTP client using `vi.fn()` for each HTTP method that returns a mock response with `.json()`.

#### Acceptance Criteria

- [ ] `DispatchResource.next()` handles both 200 (returns data) and 204 (returns null) responses
- [ ] `DispatchResource.queue()` returns `PaginatedList<DispatchQueueItem>`
- [ ] `SignalsResource.ingest()` POSTs to correct endpoint and returns both signal and issue
- [ ] All unit tests pass

**Blocked by**: Tasks 5, 6, 7 (needs errors, http, pagination modules)

---

### Task 10: [P3] Implement issues resource

Create the issues resource with full CRUD + list + iter pagination.

#### `packages/sdk/src/resources/issues.ts`

````typescript
import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  Issue,
  IssueDetail,
  CreateIssueParams,
  UpdateIssueParams,
  ListIssuesParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/**
 * Issues resource — CRUD operations on Loop's atomic unit of work.
 */
export class IssuesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List issues with optional filters and pagination.
   *
   * @param params - Filter by status, type, projectId, labelId, priority, parentId; paginate with limit/offset
   */
  async list(params?: ListIssuesParams): Promise<PaginatedList<Issue>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/issues', { searchParams })
      .json<PaginatedResponse<Issue>>();
    return new PaginatedList(response.data, response.total);
  }

  /**
   * Auto-paginating async generator that yields individual issues.
   *
   * @param params - Filter params (limit/offset are managed automatically)
   *
   * @example
   * ```typescript
   * for await (const issue of loop.issues.iter({ status: 'todo' })) {
   *   console.log(issue.title)
   * }
   * ```
   */
  iter(params?: Omit<ListIssuesParams, 'limit' | 'offset'>): AsyncGenerator<Issue> {
    return paginate((p) => this.list({ ...params, ...p }), params ?? {});
  }

  /**
   * Get a single issue by ID with parent, children, labels, and relations.
   *
   * @param id - Issue CUID2 ID
   */
  async get(id: string): Promise<IssueDetail> {
    const response = await this.http.get(`api/issues/${id}`).json<DataResponse<IssueDetail>>();
    return response.data;
  }

  /**
   * Create a new issue.
   *
   * @param params - Issue data including title, type, and optional fields
   * @param options - Per-request overrides
   */
  async create(params: CreateIssueParams, options?: RequestOptions): Promise<Issue> {
    const response = await this.http
      .post('api/issues', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Issue>>();
    return response.data;
  }

  /**
   * Update an existing issue.
   *
   * @param id - Issue CUID2 ID
   * @param params - Fields to update
   * @param options - Per-request overrides
   */
  async update(id: string, params: UpdateIssueParams, options?: RequestOptions): Promise<Issue> {
    const response = await this.http
      .patch(`api/issues/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Issue>>();
    return response.data;
  }

  /**
   * Soft-delete an issue.
   *
   * @param id - Issue CUID2 ID
   * @param options - Per-request overrides
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/issues/${id}`, toKyOptions(options));
  }
}
````

#### Unit Tests — `packages/sdk/src/__tests__/resources/issues.test.ts`

Key test scenarios:

- `list()` GETs `api/issues` with search params, returns `PaginatedList<Issue>`
- `list()` with filters passes status/type/projectId as query params
- `iter()` auto-paginates across multiple pages
- `get()` GETs `api/issues/:id`, returns `IssueDetail`
- `create()` POSTs with JSON body, returns `Issue`
- `update()` PATCHes with JSON body, returns `Issue`
- `delete()` sends DELETE, returns void

Mock the HTTP client and verify correct endpoints, methods, and response unwrapping.

#### Acceptance Criteria

- [ ] `list()` supports all filter params (status, type, projectId, labelId, priority, parentId) and pagination
- [ ] `iter()` returns an async generator that auto-paginates
- [ ] `get()` returns `IssueDetail` with parent/children/labels/relations
- [ ] `create()`, `update()`, `delete()` call correct HTTP methods and endpoints
- [ ] All unit tests pass

**Blocked by**: Tasks 5, 6, 7 (needs errors, http, pagination modules)

---

### Task 11: [P3] Implement projects, goals, and labels resources

Create the standard CRUD resources for projects, goals, and labels.

#### `packages/sdk/src/resources/projects.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  Project,
  ProjectDetail,
  CreateProjectParams,
  UpdateProjectParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/** Projects resource — CRUD operations for project containers. */
export class ProjectsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params?: PaginationParams): Promise<PaginatedList<Project>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/projects', { searchParams })
      .json<PaginatedResponse<Project>>();
    return new PaginatedList(response.data, response.total);
  }

  iter(params?: Record<string, never>): AsyncGenerator<Project> {
    return paginate((p) => this.list(p), params ?? {});
  }

  async get(id: string): Promise<ProjectDetail> {
    const response = await this.http.get(`api/projects/${id}`).json<DataResponse<ProjectDetail>>();
    return response.data;
  }

  async create(params: CreateProjectParams, options?: RequestOptions): Promise<Project> {
    const response = await this.http
      .post('api/projects', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Project>>();
    return response.data;
  }

  async update(
    id: string,
    params: UpdateProjectParams,
    options?: RequestOptions
  ): Promise<Project> {
    const response = await this.http
      .patch(`api/projects/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Project>>();
    return response.data;
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/projects/${id}`, toKyOptions(options));
  }
}
```

#### `packages/sdk/src/resources/goals.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  Goal,
  CreateGoalParams,
  UpdateGoalParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/** Goals resource — CRUD operations for measurable success indicators. */
export class GoalsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params?: PaginationParams): Promise<PaginatedList<Goal>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/goals', { searchParams })
      .json<PaginatedResponse<Goal>>();
    return new PaginatedList(response.data, response.total);
  }

  iter(params?: Record<string, never>): AsyncGenerator<Goal> {
    return paginate((p) => this.list(p), params ?? {});
  }

  async get(id: string): Promise<Goal> {
    const response = await this.http.get(`api/goals/${id}`).json<DataResponse<Goal>>();
    return response.data;
  }

  async create(params: CreateGoalParams, options?: RequestOptions): Promise<Goal> {
    const response = await this.http
      .post('api/goals', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Goal>>();
    return response.data;
  }

  async update(id: string, params: UpdateGoalParams, options?: RequestOptions): Promise<Goal> {
    const response = await this.http
      .patch(`api/goals/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Goal>>();
    return response.data;
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/goals/${id}`, toKyOptions(options));
  }
}
```

#### `packages/sdk/src/resources/labels.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  Label,
  CreateLabelParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/** Labels resource — manage issue labels (no update, only create/delete). */
export class LabelsResource {
  constructor(private readonly http: HttpClient) {}

  async list(params?: PaginationParams): Promise<PaginatedList<Label>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/labels', { searchParams })
      .json<PaginatedResponse<Label>>();
    return new PaginatedList(response.data, response.total);
  }

  iter(params?: Record<string, never>): AsyncGenerator<Label> {
    return paginate((p) => this.list(p), params ?? {});
  }

  async create(params: CreateLabelParams, options?: RequestOptions): Promise<Label> {
    const response = await this.http
      .post('api/labels', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Label>>();
    return response.data;
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/labels/${id}`, toKyOptions(options));
  }
}
```

#### Unit Tests

Write `projects.test.ts`, `goals.test.ts`, `labels.test.ts` covering:

- `list()` returns `PaginatedList` with correct data
- `get()` returns detail type (ProjectDetail for projects, Goal for goals)
- `create()` POSTs with JSON body
- `update()` PATCHes (projects, goals only — labels have no update)
- `delete()` sends DELETE
- Labels has no `update()` or `get()` method

#### Acceptance Criteria

- [ ] All three resources follow the standard CRUD pattern
- [ ] Projects `get()` returns `ProjectDetail` (with goal and issueCounts)
- [ ] Labels has no `update()` method (only create + delete)
- [ ] All resources have `list()` and `iter()` methods
- [ ] All unit tests pass

**Blocked by**: Tasks 5, 6, 7 (needs errors, http, pagination modules)

---

### Task 12: [P3] Implement comments, relations, templates, reviews, and dashboard resources

Create the remaining resource classes.

#### `packages/sdk/src/resources/comments.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toKyOptions } from '../http';
import type { Comment, CreateCommentParams, DataResponse } from '@dork-labs/loop-types';

/** Comments resource — issue sub-resource for threaded discussion. */
export class CommentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List comments for an issue (threaded).
   *
   * @param issueId - Parent issue ID
   */
  async list(issueId: string): Promise<Comment[]> {
    const response = await this.http
      .get(`api/issues/${issueId}/comments`)
      .json<{ data: Comment[] }>();
    return response.data;
  }

  /**
   * Add a comment to an issue.
   *
   * @param issueId - Parent issue ID
   * @param params - Comment body, author, and optional parent for threading
   * @param options - Per-request overrides
   */
  async create(
    issueId: string,
    params: CreateCommentParams,
    options?: RequestOptions
  ): Promise<Comment> {
    const response = await this.http
      .post(`api/issues/${issueId}/comments`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Comment>>();
    return response.data;
  }
}
```

#### `packages/sdk/src/resources/relations.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toKyOptions } from '../http';
import type { IssueRelation, CreateRelationParams, DataResponse } from '@dork-labs/loop-types';

/** Relations resource — manage blocking/related dependencies between issues. */
export class RelationsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a relation between two issues.
   *
   * @param issueId - Source issue ID
   * @param params - Relation type and target issue ID
   * @param options - Per-request overrides
   */
  async create(
    issueId: string,
    params: CreateRelationParams,
    options?: RequestOptions
  ): Promise<IssueRelation> {
    const response = await this.http
      .post(`api/issues/${issueId}/relations`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<IssueRelation>>();
    return response.data;
  }

  /**
   * Hard-delete a relation.
   *
   * @param id - Relation ID
   * @param options - Per-request overrides
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/relations/${id}`, toKyOptions(options));
  }
}
```

#### `packages/sdk/src/resources/templates.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  PromptTemplate,
  PromptVersion,
  TemplateDetail,
  TemplatePreview,
  CreateTemplateParams,
  UpdateTemplateParams,
  CreateVersionParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/** Templates resource — manage versioned prompt templates with conditions-based matching. */
export class TemplatesResource {
  constructor(private readonly http: HttpClient) {}

  async list(params?: PaginationParams): Promise<PaginatedList<PromptTemplate>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/templates', { searchParams })
      .json<PaginatedResponse<PromptTemplate>>();
    return new PaginatedList(response.data, response.total);
  }

  iter(params?: Record<string, never>): AsyncGenerator<PromptTemplate> {
    return paginate((p) => this.list(p), params ?? {});
  }

  async get(id: string): Promise<TemplateDetail> {
    const response = await this.http
      .get(`api/templates/${id}`)
      .json<DataResponse<TemplateDetail>>();
    return response.data;
  }

  async create(params: CreateTemplateParams, options?: RequestOptions): Promise<PromptTemplate> {
    const response = await this.http
      .post('api/templates', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptTemplate>>();
    return response.data;
  }

  async update(
    id: string,
    params: UpdateTemplateParams,
    options?: RequestOptions
  ): Promise<PromptTemplate> {
    const response = await this.http
      .patch(`api/templates/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptTemplate>>();
    return response.data;
  }

  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/templates/${id}`, toKyOptions(options));
  }

  /**
   * Preview which template and prompt would be selected for an issue.
   *
   * @param issueId - Issue ID to preview dispatch for
   */
  async preview(issueId: string): Promise<TemplatePreview> {
    const response = await this.http
      .get(`api/templates/preview/${issueId}`)
      .json<DataResponse<TemplatePreview>>();
    return response.data;
  }

  /**
   * List versions for a template.
   *
   * @param id - Template ID
   * @param params - Pagination params
   */
  async versions(id: string, params?: PaginationParams): Promise<PaginatedList<PromptVersion>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get(`api/templates/${id}/versions`, { searchParams })
      .json<PaginatedResponse<PromptVersion>>();
    return new PaginatedList(response.data, response.total);
  }

  /**
   * Create a new version for a template.
   *
   * @param id - Template ID
   * @param params - Version content and metadata
   * @param options - Per-request overrides
   */
  async createVersion(
    id: string,
    params: CreateVersionParams,
    options?: RequestOptions
  ): Promise<PromptVersion> {
    const response = await this.http
      .post(`api/templates/${id}/versions`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptVersion>>();
    return response.data;
  }

  /**
   * Promote a version to active status.
   *
   * @param id - Template ID
   * @param versionId - Version ID to promote
   * @param options - Per-request overrides
   */
  async promote(id: string, versionId: string, options?: RequestOptions): Promise<PromptVersion> {
    const response = await this.http
      .post(`api/templates/${id}/versions/${versionId}/promote`, {
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptVersion>>();
    return response.data;
  }
}
```

#### `packages/sdk/src/resources/reviews.ts`

```typescript
import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList } from '../pagination';
import type {
  PromptReview,
  CreateReviewParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/** Reviews resource — agent and human quality feedback on prompt versions. */
export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a prompt review.
   *
   * @param params - Review scores and optional feedback
   * @param options - Per-request overrides
   */
  async create(params: CreateReviewParams, options?: RequestOptions): Promise<PromptReview> {
    const response = await this.http
      .post('api/prompt-reviews', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptReview>>();
    return response.data;
  }

  /**
   * List reviews for a template (across all versions).
   *
   * @param templateId - Template ID
   * @param params - Pagination params
   */
  async list(templateId: string, params?: PaginationParams): Promise<PaginatedList<PromptReview>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get(`api/templates/${templateId}/reviews`, { searchParams })
      .json<PaginatedResponse<PromptReview>>();
    return new PaginatedList(response.data, response.total);
  }
}
```

#### `packages/sdk/src/resources/dashboard.ts`

```typescript
import type { HttpClient } from '../http';
import { toSearchParams } from '../http';
import type {
  DashboardStats,
  DashboardActivityItem,
  DashboardPromptHealth,
  PaginationParams,
  DataResponse,
} from '@dork-labs/loop-types';

/** Dashboard resource — system health metrics and activity overview. */
export class DashboardResource {
  constructor(private readonly http: HttpClient) {}

  /** Get system health metrics (issue counts, goal progress, dispatch stats). */
  async stats(): Promise<DashboardStats> {
    const response = await this.http
      .get('api/dashboard/stats')
      .json<DataResponse<DashboardStats>>();
    return response.data;
  }

  /**
   * Get signal chains for the activity timeline.
   *
   * @param params - Pagination params
   */
  async activity(params?: PaginationParams): Promise<DashboardActivityItem[]> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/dashboard/activity', { searchParams })
      .json<DataResponse<DashboardActivityItem[]>>();
    return response.data;
  }

  /** Get template health with review scores. */
  async prompts(): Promise<DashboardPromptHealth[]> {
    const response = await this.http
      .get('api/dashboard/prompts')
      .json<DataResponse<DashboardPromptHealth[]>>();
    return response.data;
  }
}
```

#### Unit Tests

Write test files for each resource covering:

- **comments.test.ts**: `list(issueId)` GETs correct endpoint; `create(issueId, params)` POSTs to correct endpoint
- **relations.test.ts**: `create(issueId, params)` POSTs; `delete(id)` sends DELETE to `api/relations/:id`
- **templates.test.ts**: CRUD + `preview(issueId)` + `versions(id)` + `createVersion(id, params)` + `promote(id, versionId)`
- **reviews.test.ts**: `create(params)` POSTs to `api/prompt-reviews`; `list(templateId)` GETs from `api/templates/:id/reviews`
- **dashboard.test.ts**: `stats()`, `activity()`, `prompts()` each GET correct endpoints

#### Acceptance Criteria

- [ ] Comments: `list(issueId)` and `create(issueId, params)` methods
- [ ] Relations: `create(issueId, params)` and `delete(id)` methods
- [ ] Templates: full CRUD + `preview` + `versions` + `createVersion` + `promote` (8 methods)
- [ ] Reviews: `create(params)` and `list(templateId)` methods
- [ ] Dashboard: `stats()`, `activity()`, `prompts()` methods
- [ ] All unit tests pass

**Blocked by**: Tasks 5, 6, 7 (needs errors, http, pagination modules)

---

### Task 13: [P3] Implement LoopClient class and barrel export

Wire all resources together in `LoopClient` and create the barrel export.

#### `packages/sdk/src/client.ts`

````typescript
import { createHttpClient, type LoopClientOptions } from './http';
import { IssuesResource } from './resources/issues';
import { ProjectsResource } from './resources/projects';
import { GoalsResource } from './resources/goals';
import { LabelsResource } from './resources/labels';
import { SignalsResource } from './resources/signals';
import { CommentsResource } from './resources/comments';
import { RelationsResource } from './resources/relations';
import { TemplatesResource } from './resources/templates';
import { ReviewsResource } from './resources/reviews';
import { DispatchResource } from './resources/dispatch';
import { DashboardResource } from './resources/dashboard';

/**
 * Loop SDK client — single entry point for all Loop API operations.
 *
 * @example
 * ```typescript
 * import { LoopClient } from '@dork-labs/loop-sdk'
 *
 * const loop = new LoopClient({
 *   apiKey: process.env.LOOP_API_KEY!,
 *   baseURL: 'https://api.looped.me',
 * })
 *
 * const task = await loop.dispatch.next()
 * ```
 */
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
````

#### `packages/sdk/src/index.ts`

```typescript
// Client
export { LoopClient } from './client';
export type { LoopClientOptions, RequestOptions } from './http';

// Errors
export {
  LoopError,
  LoopNotFoundError,
  LoopValidationError,
  LoopConflictError,
  LoopRateLimitError,
} from './errors';

// Pagination
export { PaginatedList } from './pagination';

// Resource classes (for advanced use cases / type narrowing)
export { IssuesResource } from './resources/issues';
export { ProjectsResource } from './resources/projects';
export { GoalsResource } from './resources/goals';
export { LabelsResource } from './resources/labels';
export { SignalsResource } from './resources/signals';
export { CommentsResource } from './resources/comments';
export { RelationsResource } from './resources/relations';
export { TemplatesResource } from './resources/templates';
export { ReviewsResource } from './resources/reviews';
export { DispatchResource } from './resources/dispatch';
export { DashboardResource } from './resources/dashboard';

// Re-export all types from @dork-labs/loop-types for convenience
export type * from '@dork-labs/loop-types';
```

#### Unit Tests — `packages/sdk/src/__tests__/client.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { LoopClient } from '../client';

// Mock createHttpClient to avoid real ky instantiation
vi.mock('../http', () => ({
  createHttpClient: vi.fn(() => ({})),
}));

// Mock all resource classes
vi.mock('../resources/issues', () => ({ IssuesResource: vi.fn() }));
vi.mock('../resources/projects', () => ({ ProjectsResource: vi.fn() }));
vi.mock('../resources/goals', () => ({ GoalsResource: vi.fn() }));
vi.mock('../resources/labels', () => ({ LabelsResource: vi.fn() }));
vi.mock('../resources/signals', () => ({ SignalsResource: vi.fn() }));
vi.mock('../resources/comments', () => ({ CommentsResource: vi.fn() }));
vi.mock('../resources/relations', () => ({ RelationsResource: vi.fn() }));
vi.mock('../resources/templates', () => ({ TemplatesResource: vi.fn() }));
vi.mock('../resources/reviews', () => ({ ReviewsResource: vi.fn() }));
vi.mock('../resources/dispatch', () => ({ DispatchResource: vi.fn() }));
vi.mock('../resources/dashboard', () => ({ DashboardResource: vi.fn() }));

describe('LoopClient', () => {
  it('requires apiKey', () => {
    const client = new LoopClient({ apiKey: 'loop_test_key' });
    expect(client).toBeDefined();
  });

  it('initializes all 11 resource namespaces', () => {
    const client = new LoopClient({ apiKey: 'loop_test_key' });
    expect(client.issues).toBeDefined();
    expect(client.projects).toBeDefined();
    expect(client.goals).toBeDefined();
    expect(client.labels).toBeDefined();
    expect(client.signals).toBeDefined();
    expect(client.comments).toBeDefined();
    expect(client.relations).toBeDefined();
    expect(client.templates).toBeDefined();
    expect(client.reviews).toBeDefined();
    expect(client.dispatch).toBeDefined();
    expect(client.dashboard).toBeDefined();
  });

  it('passes options to createHttpClient', () => {
    const { createHttpClient } = require('../http');
    const opts = { apiKey: 'loop_test_key', baseURL: 'https://api.example.com', timeout: 5000 };
    new LoopClient(opts);
    expect(createHttpClient).toHaveBeenCalledWith(opts);
  });
});
```

#### Acceptance Criteria

- [ ] `LoopClient` constructor takes `LoopClientOptions` and wires all 11 resource namespaces
- [ ] `src/index.ts` exports `LoopClient`, all error classes, `PaginatedList`, all resource classes, and re-exports types
- [ ] `npm run build` succeeds for the SDK package
- [ ] `npm run typecheck` passes
- [ ] Unit tests verify all resources are initialized
- [ ] Client test verifies options are passed to `createHttpClient`

**Blocked by**: Tasks 9, 10, 11, 12 (all resource classes must exist)

---

## Phase 4: Polish

### Task 14: [P4] Add JSDoc documentation, READMEs, and verify full build

Add JSDoc comments to all public APIs, create README.md files, and verify the complete build/test/pack pipeline.

#### JSDoc Requirements

All public methods and types should already have JSDoc from the task implementations. This task verifies completeness and adds any missing documentation. Specifically check:

- Every `export`ed function/class/interface has a TSDoc comment
- `@param` tags on all function parameters
- `@example` blocks on key methods (especially `dispatch.next()`, `issues.iter()`, `LoopClient` constructor)

#### `packages/types/README.md`

Create a README explaining:

- What the package is (shared type definitions for Loop's REST API)
- Installation: `npm install @dork-labs/loop-types`
- Usage: importing types for custom HTTP clients
- Note that most users should use `@dork-labs/loop-sdk` which re-exports all types

#### `packages/sdk/README.md`

Create a README with:

- Quickstart: install, create client, dispatch loop example
- API reference summary: list all 11 resource namespaces with their methods
- Error handling: try/catch with typed error classes
- Pagination: `list()` vs `iter()` patterns
- Configuration options table

#### Verification Steps

Run from repo root:

```bash
npm run build        # All packages build (types before sdk)
npm run typecheck    # No type errors
npm test             # All tests pass
cd packages/types && npm pack --dry-run  # Verify publishable contents
cd packages/sdk && npm pack --dry-run    # Verify publishable contents
```

Verify `npm pack` output includes only `dist/` files (not `src/`).

#### Update Root CLAUDE.md

Add `packages/types` and `packages/sdk` to the monorepo structure in the root CLAUDE.md:

```
loop/
├── apps/
│   ├── api/              # @loop/api
│   ├── app/              # @loop/app
│   └── web/              # @loop/web
├── packages/
│   ├── types/            # @dork-labs/loop-types - Shared Zod-inferred type definitions
│   ├── sdk/              # @dork-labs/loop-sdk - TypeScript SDK for Loop's REST API
│   ├── mcp/              # @dork-labs/loop-mcp - MCP server
│   └── loop-skill/       # @dork-labs/loop-skill - Agent skill content
```

#### Acceptance Criteria

- [ ] All public APIs have TSDoc comments
- [ ] `packages/types/README.md` exists with installation and usage docs
- [ ] `packages/sdk/README.md` exists with quickstart, API reference, error handling, pagination docs
- [ ] `npm run build` passes for entire monorepo
- [ ] `npm run typecheck` passes for entire monorepo
- [ ] `npm test` passes for entire monorepo
- [ ] `npm pack --dry-run` for both packages shows only `dist/` files
- [ ] Root `CLAUDE.md` updated with new packages in monorepo structure

**Blocked by**: Task 13 (client and barrel export must be complete)

---

## Dependency Graph

```
Task 1 ─┐
        ├── Task 2 ── Task 3 ── Task 4 ─┬── Task 5 ─┐
        │                                ├── Task 6 ─┤
        │                                ├── Task 7 ─┤
        │                                └── Task 8  │
        │                                            │
        │                    Tasks 5+6+7 ────────────┤
        │                                            │
        │                        ┌── Task 9  ─┐      │
        │                        ├── Task 10 ─┤      │
        │                        ├── Task 11 ─┤      │
        │                        └── Task 12 ─┘      │
        │                               │            │
        │                          Task 13 ───────────┘
        │                               │
        │                          Task 14
```

## Parallel Execution Opportunities

- **Phase 1**: Tasks 1 and 2 can partially overlap (Task 2 needs enums from Task 1)
- **Phase 2**: Tasks 5, 6, 7 can run in parallel after Task 4; Task 8 is independent
- **Phase 3**: Tasks 9, 10, 11, 12 can all run in parallel
- **Critical path**: Task 1 -> 2 -> 3 -> 4 -> 5 -> 9 -> 13 -> 14
