# @dork-labs/loop-types

Shared TypeScript types and Zod schemas for the Loop API.

This package is a peer dependency of `@dork-labs/loop-sdk` and is re-exported from it automatically. You only need to install this package directly if you are consuming Loop types without the SDK (e.g. in a server-side project that validates webhook payloads, or in a separate types-only layer).

## Installation

```bash
npm install @dork-labs/loop-types
```

## Contents

### Entities

Domain objects returned by the API:

```typescript
import type {
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
} from '@dork-labs/loop-types';
```

### Enums

String union types and their Zod schemas for all discriminated fields:

```typescript
import {
  type IssueType, // 'signal' | 'hypothesis' | 'plan' | 'task' | 'monitor'
  type IssueStatus, // 'triage' | 'todo' | 'in_progress' | 'done' | 'cancelled' | 'snoozed'
  type SignalSeverity, // 'low' | 'medium' | 'high' | 'critical'
  issueStatusSchema, // z.enum([...]) — use for Zod validation
} from '@dork-labs/loop-types';
```

### Request params

Typed parameter objects for every API operation:

```typescript
import type {
  CreateIssueParams,
  UpdateIssueParams,
  ListIssuesParams,
  IngestSignalParams,
  // ... all Create* / Update* / List* types
} from '@dork-labs/loop-types';
```

### Response shapes

```typescript
import type {
  DataResponse, // { data: T }
  PaginatedResponse, // { data: T[]; total: number }
  DispatchNextResponse, // { issue: IssueDetail; prompt: string; templateSlug: string }
  DashboardStats,
  DashboardActivityItem,
  DashboardPromptHealth,
} from '@dork-labs/loop-types';
```

### JSONB field types

Structured payloads stored in JSONB columns:

```typescript
import type {
  HypothesisData, // { summary; confidence; validationCriteria; ... }
  SignalPayload, // Record<string, unknown>
  CommitRef, // { sha; message; url }
  PullRequestRef, // { number; title; url; state }
  TemplateConditions, // { issueType?; signalSource?; projectId?; ... }
} from '@dork-labs/loop-types';
```

## Usage with the SDK

`@dork-labs/loop-sdk` re-exports everything from this package, so you rarely need to import from `@dork-labs/loop-types` directly:

```typescript
import { LoopClient, type Issue, type IssueStatus } from '@dork-labs/loop-sdk';
```

## License

MIT
