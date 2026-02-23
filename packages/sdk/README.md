# @dork-labs/loop-sdk

TypeScript SDK for the [Loop](https://www.looped.me) API — the Autonomous Improvement Engine.

## Installation

```bash
npm install @dork-labs/loop-sdk
# or
pnpm add @dork-labs/loop-sdk
```

## Usage

```typescript
import { LoopClient } from '@dork-labs/loop-sdk';

const loop = new LoopClient({ apiKey: 'loop_your_key_here' });
```

### Claim the next task (agent polling)

```typescript
const task = await loop.dispatch.next();

if (task) {
  console.log(task.issue.title);
  console.log(task.prompt); // hydrated instructions ready for your agent
} else {
  console.log('Queue is empty');
}
```

### Ingest a signal

```typescript
const result = await loop.signals.ingest({
  source: 'posthog',
  type: 'metric_alert',
  severity: 'high',
  payload: {
    event: 'conversion_drop',
    value: -0.12,
    window: '24h',
  },
});

console.log(result.issueId); // triage issue created from the signal
```

### Work with issues

```typescript
// List issues
const page = await loop.issues.list({ status: 'todo', limit: 20 });
console.log(`${page.data.length} of ${page.total} issues`);

// Auto-paginate all issues
for await (const issue of loop.issues.iter({ status: 'in_progress' })) {
  console.log(issue.title);
}

// Create an issue
const issue = await loop.issues.create({
  title: 'Fix OAuth redirect blank screen',
  type: 'bug',
  priority: 1,
});

// Update and close
await loop.issues.update(issue.id, { status: 'done' });
```

### Projects and goals

```typescript
const project = await loop.projects.create({
  name: 'Improve onboarding',
});

const goal = await loop.goals.create({
  title: 'Increase sign-up conversion to 4%',
  metric: 'signup_conversion_rate',
  targetValue: 4.0,
  unit: '%',
  projectId: project.id,
});
```

### Prompt templates

```typescript
// Create a versioned template
const template = await loop.templates.create({
  slug: 'triage-posthog-metric',
  name: 'Triage: PostHog metric alert',
  conditions: { signalSource: 'posthog' },
});

await loop.templates.createVersion(template.id, {
  content: '## Triage this PostHog alert\n\n...',
  changelog: 'Initial version',
  authorType: 'human',
  authorName: 'Dorian',
});

// Preview which template and prompt would be selected for an issue
const preview = await loop.templates.preview(issueId);
console.log(preview.templateSlug, preview.prompt);
```

### Dashboard metrics

```typescript
const stats = await loop.dashboard.stats();
console.log(stats.openIssues, stats.dispatchedToday);

const activity = await loop.dashboard.activity({ limit: 10 });
```

## Error handling

All API errors are typed and extend `LoopError`.

```typescript
import { LoopError, LoopNotFoundError, LoopValidationError } from '@dork-labs/loop-sdk';

try {
  await loop.issues.get('nonexistent-id');
} catch (err) {
  if (err instanceof LoopNotFoundError) {
    console.log('Issue not found');
  } else if (err instanceof LoopValidationError) {
    console.log('Validation error:', err.details);
  } else if (err instanceof LoopError) {
    console.log(`API error ${err.status}: ${err.message}`);
  }
}
```

| Class                 | Status | Code               |
| --------------------- | ------ | ------------------ |
| `LoopNotFoundError`   | 404    | `NOT_FOUND`        |
| `LoopValidationError` | 422    | `VALIDATION_ERROR` |
| `LoopConflictError`   | 409    | `CONFLICT`         |
| `LoopRateLimitError`  | 429    | `RATE_LIMITED`     |

## Client options

```typescript
const loop = new LoopClient({
  apiKey: 'loop_your_key_here',
  baseURL: 'https://api.looped.me', // default: http://localhost:5667
  timeout: 10_000, // ms, default: 30 000
  maxRetries: 3, // default: 2
});
```

## Pagination

Resources that return lists expose both a `list()` method and an `iter()` async generator.

```typescript
// Manual pagination
const page = await loop.issues.list({ limit: 50, offset: 100 });
if (page.hasMore) {
  /* fetch next page */
}

// Auto-pagination (recommended for full traversal)
for await (const issue of loop.issues.iter()) {
  // yields every issue, page by page, automatically
}
```

## Per-request options

Mutating methods accept an optional `RequestOptions` argument.

```typescript
const ac = new AbortController();
setTimeout(() => ac.abort(), 5_000);

await loop.issues.create(
  { title: 'Time-sensitive fix', type: 'bug' },
  { signal: ac.signal, idempotencyKey: 'my-unique-key-123' }
);
```

## Resources

| Property         | Description                                           |
| ---------------- | ----------------------------------------------------- |
| `loop.dispatch`  | Claim prioritised work from the queue                 |
| `loop.issues`    | CRUD for Loop's atomic unit of work                   |
| `loop.projects`  | Group issues toward a shared objective                |
| `loop.goals`     | Measurable success indicators for projects            |
| `loop.labels`    | Categorical tags for issues                           |
| `loop.signals`   | Ingest external events (PostHog, GitHub, Sentry)      |
| `loop.comments`  | Threaded discussion on issues                         |
| `loop.relations` | Blocking/related dependencies between issues          |
| `loop.templates` | Versioned prompt instructions for the dispatch engine |
| `loop.reviews`   | Agent and human quality feedback on prompt versions   |
| `loop.dashboard` | System health metrics and activity overview           |

## License

MIT
