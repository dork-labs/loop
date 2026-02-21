/**
 * OpenAPI schema registry for the Loop API.
 *
 * Registers all Zod schemas and route paths with OpenAPI metadata,
 * enabling documentation generation via @asteasolutions/zod-to-openapi.
 *
 * Call `generateOpenApiDocument()` to produce a complete OpenAPI 3.1 spec.
 */
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  issueTypeValues,
  issueStatusValues,
  relationTypeValues,
  authorTypeValues,
} from '../db/schema/issues'
import { signalSeverityValues } from '../db/schema/signals'
import {
  projectStatusValues,
  projectHealthValues,
  goalStatusValues,
} from '../db/schema/projects'
import { promptVersionStatusValues } from '../db/schema/prompts'

// Extend Zod with OpenAPI support — must be called once before any schema definitions
extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

// ─── Template conditions (inline to avoid cross-module extendZodWithOpenApi timing) ──

const ConditionsSchema = z
  .object({
    type: z.enum(issueTypeValues).optional(),
    signalSource: z.string().optional(),
    labels: z.array(z.string()).optional(),
    projectId: z.string().optional(),
    hasFailedSessions: z.boolean().optional(),
    hypothesisConfidence: z.number().min(0).max(1).optional(),
  })
  .openapi({
    description: 'Conditions that determine when this template is selected',
    example: { type: 'signal' },
  })

// ─── Shared primitives ────────────────────────────────────────────────────────

const IdSchema = z.string().openapi({ example: 'cuid2_abc123' })
const DateTimeSchema = z.string().openapi({
  format: 'date-time',
  example: '2026-02-20T12:00:00.000Z',
})
const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50).openapi({
    description: 'Maximum records to return (1–200)',
    example: 50,
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: 'Number of records to skip',
    example: 0,
  }),
})

// ─── Issues ───────────────────────────────────────────────────────────────────

const HypothesisDataSchema = z
  .object({
    statement: z.string().openapi({ example: 'Switching to a new auth provider will reduce login failures by 30%' }),
    confidence: z.number().min(0).max(1).openapi({ example: 0.75 }),
    evidence: z.array(z.string()).openapi({ example: ['Login failure rate up 20%', 'PostHog session data shows 15% drop-off'] }),
    validationCriteria: z.string().openapi({ example: 'Login failure rate drops below 5% within 30 days' }),
    prediction: z.string().optional().openapi({ example: 'Failure rate reduced to ~2%' }),
  })
  .openapi('HypothesisData')

const CommitRefSchema = z
  .object({
    sha: z.string().openapi({ example: 'abc123def456' }),
    message: z.string().openapi({ example: 'fix: correct auth token expiry' }),
    url: z.string().optional().openapi({ example: 'https://github.com/org/repo/commit/abc123' }),
    author: z.string().optional().openapi({ example: 'agent-claude' }),
    timestamp: z.string().optional().openapi({ example: '2026-02-20T10:00:00Z' }),
  })
  .openapi('CommitRef')

const PullRequestRefSchema = z
  .object({
    number: z.number().openapi({ example: 42 }),
    title: z.string().openapi({ example: 'fix: correct auth token expiry' }),
    url: z.string().optional().openapi({ example: 'https://github.com/org/repo/pull/42' }),
    state: z.string().optional().openapi({ example: 'merged' }),
    mergedAt: z.string().nullable().optional().openapi({ example: '2026-02-20T11:00:00Z' }),
  })
  .openapi('PullRequestRef')

const IssueSchema = registry.register(
  'Issue',
  z.object({
    id: IdSchema,
    number: z.number().int().openapi({ example: 1 }),
    title: z.string().openapi({ example: '[PostHog] error_rate: Login failures spiked' }),
    description: z.string().nullable().openapi({ example: 'Auth failure rate exceeded 20% over the last hour.' }),
    type: z.enum(issueTypeValues).openapi({ example: 'signal' }),
    status: z.enum(issueStatusValues).openapi({ example: 'triage' }),
    priority: z.number().int().min(0).max(4).openapi({ example: 2 }),
    parentId: IdSchema.nullable().openapi({ example: null }),
    projectId: IdSchema.nullable().openapi({ example: null }),
    signalSource: z.string().nullable().openapi({ example: 'posthog' }),
    signalPayload: z.record(z.string(), z.unknown()).nullable().openapi({ example: { event: 'error_rate', value: 0.22 } }),
    hypothesis: HypothesisDataSchema.nullable(),
    agentSessionId: z.string().nullable().openapi({ example: null }),
    agentSummary: z.string().nullable().openapi({ example: null }),
    commits: z.array(CommitRefSchema).nullable(),
    pullRequests: z.array(PullRequestRefSchema).nullable(),
    completedAt: DateTimeSchema.nullable().openapi({ example: null }),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    deletedAt: DateTimeSchema.nullable().openapi({ example: null }),
  })
)

const LabelSchema = registry.register(
  'Label',
  z.object({
    id: IdSchema,
    name: z.string().openapi({ example: 'frontend' }),
    color: z.string().openapi({ example: '#ff6b6b' }),
    createdAt: DateTimeSchema,
    deletedAt: DateTimeSchema.nullable(),
  })
)

const IssueRelationSchema = registry.register(
  'IssueRelation',
  z.object({
    id: IdSchema,
    type: z.enum(relationTypeValues).openapi({ example: 'blocks' }),
    issueId: IdSchema,
    relatedIssueId: IdSchema,
    createdAt: DateTimeSchema,
  })
)

const CommentSchema = registry.register(
  'Comment',
  z.object({
    id: IdSchema,
    body: z.string().openapi({ example: 'Investigated — this is caused by an expired JWT secret.' }),
    issueId: IdSchema,
    authorName: z.string().openapi({ example: 'claude-agent' }),
    authorType: z.enum(authorTypeValues).openapi({ example: 'agent' }),
    parentId: IdSchema.nullable(),
    createdAt: DateTimeSchema,
  })
)

// ─── Projects + Goals ─────────────────────────────────────────────────────────

const GoalSchema = registry.register(
  'Goal',
  z.object({
    id: IdSchema,
    title: z.string().openapi({ example: 'Reduce login failure rate to < 5%' }),
    description: z.string().nullable().openapi({ example: 'Track auth failure rates from PostHog.' }),
    metric: z.string().nullable().openapi({ example: 'login_failure_rate' }),
    targetValue: z.number().nullable().openapi({ example: 0.05 }),
    currentValue: z.number().nullable().openapi({ example: 0.18 }),
    unit: z.string().nullable().openapi({ example: 'ratio' }),
    status: z.enum(goalStatusValues).openapi({ example: 'active' }),
    projectId: IdSchema.nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    deletedAt: DateTimeSchema.nullable(),
  })
)

const ProjectSchema = registry.register(
  'Project',
  z.object({
    id: IdSchema,
    name: z.string().openapi({ example: 'Auth Reliability' }),
    description: z.string().nullable().openapi({ example: 'Improve authentication reliability and reduce failures.' }),
    status: z.enum(projectStatusValues).openapi({ example: 'active' }),
    health: z.enum(projectHealthValues).openapi({ example: 'on_track' }),
    goalId: IdSchema.nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    deletedAt: DateTimeSchema.nullable(),
  })
)

// ─── Signals ──────────────────────────────────────────────────────────────────

const SignalSchema = registry.register(
  'Signal',
  z.object({
    id: IdSchema,
    source: z.string().openapi({ example: 'posthog' }),
    sourceId: z.string().nullable().openapi({ example: 'evt_12345' }),
    type: z.string().openapi({ example: 'error_rate' }),
    severity: z.enum(signalSeverityValues).openapi({ example: 'high' }),
    payload: z.record(z.string(), z.unknown()).openapi({ example: { event: 'error_rate', value: 0.22 } }),
    issueId: IdSchema,
    createdAt: DateTimeSchema,
  })
)

// ─── Prompt templates, versions, reviews ─────────────────────────────────────

const PromptTemplateSchema = registry.register(
  'PromptTemplate',
  z.object({
    id: IdSchema,
    slug: z.string().openapi({ example: 'signal-triage' }),
    name: z.string().openapi({ example: 'Signal Triage' }),
    description: z.string().nullable().openapi({ example: 'Default template for triaging incoming signals.' }),
    conditions: ConditionsSchema.openapi({
      description: 'Conditions that determine when this template is selected',
      example: { type: 'signal' },
    }),
    specificity: z.number().int().min(0).max(100).openapi({ example: 10 }),
    projectId: IdSchema.nullable(),
    activeVersionId: IdSchema.nullable(),
    createdAt: DateTimeSchema,
    updatedAt: DateTimeSchema,
    deletedAt: DateTimeSchema.nullable(),
  })
)

const PromptVersionSchema = registry.register(
  'PromptVersion',
  z.object({
    id: IdSchema,
    templateId: IdSchema,
    version: z.number().int().openapi({ example: 1 }),
    content: z.string().openapi({ example: '# Signal Triage: {{issue.title}}\n\nYou are triaging signal #{{issue.number}}.' }),
    changelog: z.string().nullable().openapi({ example: 'Initial version' }),
    authorType: z.enum(authorTypeValues).openapi({ example: 'human' }),
    authorName: z.string().openapi({ example: 'system' }),
    status: z.enum(promptVersionStatusValues).openapi({ example: 'active' }),
    usageCount: z.number().int().openapi({ example: 0 }),
    completionRate: z.number().nullable().openapi({ example: null }),
    avgDurationMs: z.number().nullable().openapi({ example: null }),
    reviewScore: z.number().nullable().openapi({ example: null }),
    createdAt: DateTimeSchema,
  })
)

const PromptReviewSchema = registry.register(
  'PromptReview',
  z.object({
    id: IdSchema,
    versionId: IdSchema,
    issueId: IdSchema,
    clarity: z.number().int().min(1).max(5).openapi({ example: 4 }),
    completeness: z.number().int().min(1).max(5).openapi({ example: 5 }),
    relevance: z.number().int().min(1).max(5).openapi({ example: 3 }),
    feedback: z.string().nullable().openapi({ example: 'Instructions were clear but missing error handling steps.' }),
    authorType: z.enum(authorTypeValues).openapi({ example: 'agent' }),
    createdAt: DateTimeSchema,
  })
)

// ─── Response wrappers ────────────────────────────────────────────────────────

/** Wraps a single item response: `{ data: T }` */
function dataResponse<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema })
}

/** Wraps a paginated list response: `{ data: T[], total: number }` */
function paginatedResponse<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    data: z.array(schema),
    total: z.number().int().openapi({ example: 42 }),
  })
}

/** Error response shape returned by the global error handler. */
const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Issue not found' }),
})

// ─── Security scheme ──────────────────────────────────────────────────────────

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'API key passed as Bearer token in the Authorization header',
})

// ─── Health endpoints ─────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health check',
  description: 'Returns service health status. No authentication required.',
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean().openapi({ example: true }),
            service: z.string().openapi({ example: 'loop-api' }),
            timestamp: DateTimeSchema,
          }),
        },
      },
    },
  },
})

registry.registerPath({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'Service info',
  description: 'Returns service name and version. No authentication required.',
  responses: {
    200: {
      description: 'Service information',
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().openapi({ example: 'Loop API' }),
            version: z.string().openapi({ example: '0.1.0' }),
          }),
        },
      },
    },
  },
})

// ─── Issues endpoints ─────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/issues',
  tags: ['Issues'],
  summary: 'List issues',
  description: 'Returns a paginated list of issues, filterable by status, type, projectId, labelId, priority, and parentId.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      status: z.string().optional().openapi({
        description: 'Comma-separated list of statuses to filter by',
        example: 'todo,in_progress',
      }),
      type: z.string().optional().openapi({
        description: 'Comma-separated list of types to filter by',
        example: 'signal,task',
      }),
      projectId: z.string().optional().openapi({ example: 'cuid2_proj' }),
      labelId: z.string().optional().openapi({ example: 'cuid2_label' }),
      priority: z.coerce.number().int().min(0).max(4).optional().openapi({ example: 2 }),
      parentId: z.string().optional().openapi({ example: 'cuid2_parent' }),
      limit: z.coerce.number().int().min(1).max(200).default(50).openapi({ example: 50 }),
      offset: z.coerce.number().int().min(0).default(0).openapi({ example: 0 }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated list of issues',
      content: {
        'application/json': {
          schema: paginatedResponse(IssueSchema),
        },
      },
    },
    401: { description: 'Unauthorized — invalid or missing Bearer token' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/issues',
  tags: ['Issues'],
  summary: 'Create an issue',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.string().min(1).max(500).openapi({ example: 'Investigate login failure spike' }),
            description: z.string().optional().openapi({ example: 'Auth failure rate exceeded 20% over the last hour.' }),
            type: z.enum(issueTypeValues).openapi({ example: 'signal' }),
            status: z.enum(issueStatusValues).default('triage').openapi({ example: 'triage' }),
            priority: z.number().int().min(0).max(4).default(0).openapi({ example: 2 }),
            parentId: z.string().optional().openapi({ example: undefined }),
            projectId: z.string().optional().openapi({ example: undefined }),
            signalSource: z.string().optional().openapi({ example: 'posthog' }),
            signalPayload: z.record(z.string(), z.unknown()).optional(),
            hypothesis: HypothesisDataSchema.optional(),
            labelIds: z.array(z.string()).optional().openapi({ example: [] }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Issue created',
      content: { 'application/json': { schema: dataResponse(IssueSchema) } },
    },
    401: { description: 'Unauthorized' },
    422: { description: 'Validation error or parent hierarchy violation' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/issues/{id}',
  tags: ['Issues'],
  summary: 'Get issue by ID',
  description: 'Returns the issue with its parent, children, labels, and relations.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
  },
  responses: {
    200: {
      description: 'Issue with related data',
      content: {
        'application/json': {
          schema: dataResponse(
            IssueSchema.extend({
              parent: IssueSchema.nullable(),
              children: z.array(IssueSchema),
              labels: z.array(LabelSchema),
              relations: z.array(IssueRelationSchema),
            })
          ),
        },
      },
    },
    404: { description: 'Issue not found' },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/issues/{id}',
  tags: ['Issues'],
  summary: 'Update an issue',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.string().min(1).max(500).optional(),
            description: z.string().optional(),
            type: z.enum(issueTypeValues).optional(),
            status: z.enum(issueStatusValues).optional(),
            priority: z.number().int().min(0).max(4).optional(),
            parentId: z.string().nullable().optional(),
            projectId: z.string().nullable().optional(),
            signalSource: z.string().optional(),
            signalPayload: z.record(z.string(), z.unknown()).optional(),
            hypothesis: HypothesisDataSchema.nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Updated issue', content: { 'application/json': { schema: dataResponse(IssueSchema) } } },
    404: { description: 'Issue not found' },
    422: { description: 'Validation error' },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/issues/{id}',
  tags: ['Issues'],
  summary: 'Soft-delete an issue',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    204: { description: 'Issue deleted' },
    404: { description: 'Issue not found' },
  },
})

// ─── Issue relations endpoints ────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/issues/{id}/relations',
  tags: ['Relations'],
  summary: 'Create a relation between two issues',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            type: z.enum(relationTypeValues).openapi({ example: 'blocks' }),
            relatedIssueId: IdSchema.openapi({ description: 'ID of the related issue' }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Relation created', content: { 'application/json': { schema: dataResponse(IssueRelationSchema) } } },
    404: { description: 'Issue not found' },
    422: { description: 'Validation error or self-relation' },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/relations/{id}',
  tags: ['Relations'],
  summary: 'Hard-delete a relation',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    204: { description: 'Relation deleted' },
    404: { description: 'Relation not found' },
  },
})

// ─── Comments endpoints ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/issues/{id}/comments',
  tags: ['Comments'],
  summary: 'List comments for an issue',
  description: 'Returns threaded comments (top-level with nested replies).',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    200: {
      description: 'Threaded comment list',
      content: {
        'application/json': {
          schema: dataResponse(
            z.array(
              CommentSchema.extend({ replies: z.array(CommentSchema) })
            )
          ),
        },
      },
    },
    404: { description: 'Issue not found' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/issues/{id}/comments',
  tags: ['Comments'],
  summary: 'Add a comment to an issue',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            body: z.string().min(1).openapi({ example: 'Investigated the auth logs — found an expired JWT secret.' }),
            authorName: z.string().min(1).openapi({ example: 'claude-agent' }),
            authorType: z.enum(authorTypeValues).openapi({ example: 'agent' }),
            parentId: z.string().optional().openapi({ description: 'Parent comment ID for threaded replies' }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Comment created', content: { 'application/json': { schema: dataResponse(CommentSchema) } } },
    404: { description: 'Issue not found' },
    422: { description: 'Validation error or parent comment not found' },
  },
})

// ─── Labels endpoints ─────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/labels',
  tags: ['Labels'],
  summary: 'List labels',
  security: [{ bearerAuth: [] }],
  request: { query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of labels',
      content: { 'application/json': { schema: paginatedResponse(LabelSchema) } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/labels',
  tags: ['Labels'],
  summary: 'Create a label',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(100).openapi({ example: 'frontend' }),
            color: z.string().min(1).max(50).openapi({ example: '#ff6b6b' }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Label created', content: { 'application/json': { schema: dataResponse(LabelSchema) } } },
    409: { description: 'Label name already exists' },
    422: { description: 'Validation error' },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/labels/{id}',
  tags: ['Labels'],
  summary: 'Soft-delete a label',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    204: { description: 'Label deleted' },
    404: { description: 'Label not found' },
  },
})

// ─── Projects endpoints ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/projects',
  tags: ['Projects'],
  summary: 'List projects',
  security: [{ bearerAuth: [] }],
  request: { query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of projects',
      content: { 'application/json': { schema: paginatedResponse(ProjectSchema) } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/projects',
  tags: ['Projects'],
  summary: 'Create a project',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(500).openapi({ example: 'Auth Reliability' }),
            description: z.string().optional().openapi({ example: 'Improve authentication reliability.' }),
            status: z.enum(projectStatusValues).default('backlog').openapi({ example: 'active' }),
            health: z.enum(projectHealthValues).default('on_track').openapi({ example: 'on_track' }),
            goalId: z.string().optional().openapi({ example: undefined }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Project created', content: { 'application/json': { schema: dataResponse(ProjectSchema) } } },
    422: { description: 'Validation error or goal not found' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/projects/{id}',
  tags: ['Projects'],
  summary: 'Get project by ID',
  description: 'Returns the project with linked goal and issue counts by status.',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    200: {
      description: 'Project with goal and issue counts',
      content: {
        'application/json': {
          schema: dataResponse(
            ProjectSchema.extend({
              goal: GoalSchema.nullable(),
              issueCounts: z.record(z.string(), z.number()).openapi({ example: { todo: 3, in_progress: 1, done: 10 } }),
            })
          ),
        },
      },
    },
    404: { description: 'Project not found' },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/projects/{id}',
  tags: ['Projects'],
  summary: 'Update a project',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(500).optional(),
            description: z.string().optional(),
            status: z.enum(projectStatusValues).optional(),
            health: z.enum(projectHealthValues).optional(),
            goalId: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Updated project', content: { 'application/json': { schema: dataResponse(ProjectSchema) } } },
    404: { description: 'Project not found' },
    422: { description: 'Validation error or goal not found' },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/projects/{id}',
  tags: ['Projects'],
  summary: 'Soft-delete a project',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    204: { description: 'Project deleted' },
    404: { description: 'Project not found' },
  },
})

// ─── Goals endpoints ──────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/goals',
  tags: ['Goals'],
  summary: 'List goals',
  security: [{ bearerAuth: [] }],
  request: { query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of goals',
      content: { 'application/json': { schema: paginatedResponse(GoalSchema) } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/goals',
  tags: ['Goals'],
  summary: 'Create a goal',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.string().min(1).max(500).openapi({ example: 'Reduce login failure rate to < 5%' }),
            description: z.string().optional(),
            metric: z.string().optional().openapi({ example: 'login_failure_rate' }),
            targetValue: z.number().optional().openapi({ example: 0.05 }),
            currentValue: z.number().optional().openapi({ example: 0.18 }),
            unit: z.string().optional().openapi({ example: 'ratio' }),
            status: z.enum(goalStatusValues).default('active').openapi({ example: 'active' }),
            projectId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Goal created', content: { 'application/json': { schema: dataResponse(GoalSchema) } } },
    422: { description: 'Validation error' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/goals/{id}',
  tags: ['Goals'],
  summary: 'Get goal by ID',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    200: { description: 'Goal', content: { 'application/json': { schema: dataResponse(GoalSchema) } } },
    404: { description: 'Goal not found' },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/goals/{id}',
  tags: ['Goals'],
  summary: 'Update a goal',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.string().min(1).max(500).optional(),
            description: z.string().nullable().optional(),
            metric: z.string().nullable().optional(),
            targetValue: z.number().nullable().optional(),
            currentValue: z.number().nullable().optional(),
            unit: z.string().nullable().optional(),
            status: z.enum(goalStatusValues).optional(),
            projectId: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Updated goal', content: { 'application/json': { schema: dataResponse(GoalSchema) } } },
    404: { description: 'Goal not found' },
    422: { description: 'Validation error' },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/goals/{id}',
  tags: ['Goals'],
  summary: 'Soft-delete a goal',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    204: { description: 'Goal deleted' },
    404: { description: 'Goal not found' },
  },
})

// ─── Signals endpoints ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/signals',
  tags: ['Signals'],
  summary: 'Ingest a signal',
  description: 'Creates a signal and atomically creates a linked triage issue.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            source: z.string().min(1).openapi({ example: 'posthog' }),
            sourceId: z.string().optional().openapi({ example: 'evt_12345' }),
            type: z.string().min(1).openapi({ example: 'error_rate' }),
            severity: z.enum(signalSeverityValues).openapi({ example: 'high' }),
            payload: z.record(z.string(), z.unknown()).openapi({ example: { event: 'error_rate', value: 0.22 } }),
            projectId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Signal and linked issue created',
      content: {
        'application/json': {
          schema: dataResponse(
            z.object({ signal: SignalSchema, issue: IssueSchema })
          ),
        },
      },
    },
    422: { description: 'Validation error' },
  },
})

// ─── Templates endpoints ──────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/templates',
  tags: ['Templates'],
  summary: 'List prompt templates',
  security: [{ bearerAuth: [] }],
  request: { query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'Paginated list of prompt templates',
      content: { 'application/json': { schema: paginatedResponse(PromptTemplateSchema) } },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/templates',
  tags: ['Templates'],
  summary: 'Create a prompt template',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            slug: z
              .string()
              .min(1)
              .max(200)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase alphanumeric with hyphens')
              .openapi({ example: 'signal-triage' }),
            name: z.string().min(1).max(500).openapi({ example: 'Signal Triage' }),
            description: z.string().optional().openapi({ example: 'Default template for triaging signals.' }),
            conditions: ConditionsSchema.default({}).openapi({
              example: { type: 'signal' },
            }),
            specificity: z.number().int().min(0).max(100).default(10).openapi({ example: 10 }),
            projectId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Template created', content: { 'application/json': { schema: dataResponse(PromptTemplateSchema) } } },
    409: { description: 'Template slug already exists' },
    422: { description: 'Validation error' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/templates/{id}',
  tags: ['Templates'],
  summary: 'Get template by ID',
  description: 'Returns the template with its active version.',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    200: {
      description: 'Template with active version',
      content: {
        'application/json': {
          schema: dataResponse(PromptTemplateSchema.extend({ activeVersion: PromptVersionSchema.nullable() })),
        },
      },
    },
    404: { description: 'Template not found' },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/templates/{id}',
  tags: ['Templates'],
  summary: 'Update a template',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(500).optional(),
            description: z.string().optional(),
            conditions: ConditionsSchema.optional(),
            specificity: z.number().int().min(0).max(100).optional(),
            projectId: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Updated template', content: { 'application/json': { schema: dataResponse(PromptTemplateSchema) } } },
    404: { description: 'Template not found' },
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/templates/{id}',
  tags: ['Templates'],
  summary: 'Soft-delete a template',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdSchema }) },
  responses: {
    204: { description: 'Template deleted' },
    404: { description: 'Template not found' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/templates/{id}/versions',
  tags: ['Templates'],
  summary: 'List versions for a template',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of versions',
      content: { 'application/json': { schema: paginatedResponse(PromptVersionSchema) } },
    },
    404: { description: 'Template not found' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/templates/{id}/versions',
  tags: ['Templates'],
  summary: 'Create a new version',
  description: 'Auto-increments version number. Rejects content containing triple-braces to prevent template injection.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.string().min(1).openapi({ example: '# Signal Triage: {{issue.title}}\n\n...' }),
            changelog: z.string().optional().openapi({ example: 'Improved instructions for signal analysis.' }),
            authorType: z.enum(authorTypeValues).openapi({ example: 'human' }),
            authorName: z.string().min(1).openapi({ example: 'dorian' }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Version created', content: { 'application/json': { schema: dataResponse(PromptVersionSchema) } } },
    404: { description: 'Template not found' },
    422: { description: 'Triple-brace content rejected' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/templates/{id}/versions/{versionId}/promote',
  tags: ['Templates'],
  summary: 'Promote a version to active',
  description: 'Sets the version as active and retires the current active version.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema, versionId: IdSchema }),
  },
  responses: {
    200: { description: 'Version promoted', content: { 'application/json': { schema: dataResponse(PromptVersionSchema) } } },
    404: { description: 'Template or version not found' },
    422: { description: 'Version is already active' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/templates/{id}/reviews',
  tags: ['Templates'],
  summary: 'List reviews for a template',
  description: 'Returns reviews across all versions of the template.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdSchema }),
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of reviews',
      content: { 'application/json': { schema: paginatedResponse(PromptReviewSchema) } },
    },
    404: { description: 'Template not found' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/templates/preview/{issueId}',
  tags: ['Templates'],
  summary: 'Preview template selection for an issue',
  description: 'Selects and hydrates a template for the given issue without claiming it. Useful for debugging template selection.',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ issueId: IdSchema }) },
  responses: {
    200: {
      description: 'Template selection preview with hydrated prompt',
      content: {
        'application/json': {
          schema: z.object({
            issue: z.object({
              id: IdSchema,
              number: z.number().int(),
              title: z.string(),
              type: z.enum(issueTypeValues),
            }),
            template: z
              .object({
                id: IdSchema,
                slug: z.string(),
                name: z.string().optional(),
                conditions: ConditionsSchema,
                specificity: z.number().int(),
              })
              .nullable(),
            version: z.object({ id: IdSchema, version: z.number().int() }).nullable(),
            prompt: z.string().nullable().openapi({ description: 'Hydrated Handlebars prompt content' }),
            message: z.string().optional().openapi({ example: 'No matching template found' }),
          }),
        },
      },
    },
    404: { description: 'Issue not found' },
  },
})

// ─── Prompt reviews endpoint ──────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/prompt-reviews',
  tags: ['Prompt Reviews'],
  summary: 'Submit a prompt review',
  description: 'Submits a quality review for a prompt version. Updates the version\'s EWMA review score and triggers an improvement issue if quality degrades below threshold.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            versionId: IdSchema.openapi({ description: 'The prompt version being reviewed' }),
            issueId: IdSchema.openapi({ description: 'The issue this prompt was used for' }),
            clarity: z.number().int().min(1).max(5).openapi({ example: 4 }),
            completeness: z.number().int().min(1).max(5).openapi({ example: 5 }),
            relevance: z.number().int().min(1).max(5).openapi({ example: 3 }),
            feedback: z.string().optional().openapi({ example: 'Instructions were clear but missing error handling steps.' }),
            authorType: z.enum(authorTypeValues).openapi({ example: 'agent' }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Review submitted', content: { 'application/json': { schema: dataResponse(PromptReviewSchema) } } },
    404: { description: 'Version not found' },
    422: { description: 'Validation error' },
  },
})

// ─── Dispatch endpoints ───────────────────────────────────────────────────────

const DispatchIssueSchema = z.object({
  id: IdSchema,
  number: z.number().int().openapi({ example: 42 }),
  title: z.string().openapi({ example: '[PostHog] error_rate: Login failures spiked' }),
  type: z.enum(issueTypeValues).openapi({ example: 'signal' }),
  priority: z.number().int().openapi({ example: 2 }),
  status: z.enum(issueStatusValues).openapi({ example: 'in_progress' }),
})

registry.registerPath({
  method: 'get',
  path: '/api/dispatch/next',
  tags: ['Dispatch'],
  summary: 'Claim the highest-priority unblocked issue',
  description: 'Atomically claims the highest-priority unblocked todo issue using FOR UPDATE SKIP LOCKED, sets it to in_progress, selects the best matching template, and returns a hydrated prompt. Returns 204 when queue is empty.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      projectId: z.string().optional().openapi({ description: 'Restrict dispatch to issues in this project', example: 'cuid2_proj' }),
    }),
  },
  responses: {
    200: {
      description: 'Claimed issue with hydrated prompt',
      content: {
        'application/json': {
          schema: z.object({
            issue: DispatchIssueSchema,
            prompt: z.string().nullable().openapi({ description: 'Hydrated prompt text, or null if no template matched' }),
            meta: z
              .object({
                templateSlug: z.string().openapi({ example: 'signal-triage' }),
                templateId: IdSchema,
                versionId: IdSchema,
                versionNumber: z.number().int().openapi({ example: 1 }),
                reviewUrl: z.string().openapi({ example: 'POST /api/prompt-reviews' }),
              })
              .nullable(),
          }),
        },
      },
    },
    204: { description: 'No eligible issues in queue' },
    401: { description: 'Unauthorized' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/dispatch/queue',
  tags: ['Dispatch'],
  summary: 'Preview the priority-ordered dispatch queue',
  description: 'Returns unblocked todo issues sorted by priority score (does not claim any issues).',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      projectId: z.string().optional().openapi({ example: 'cuid2_proj' }),
      limit: z.coerce.number().int().min(1).max(200).default(50).openapi({ example: 50 }),
      offset: z.coerce.number().int().min(0).default(0).openapi({ example: 0 }),
    }),
  },
  responses: {
    200: {
      description: 'Scored issue queue',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                issue: IssueSchema,
                score: z.number().openapi({ example: 148 }),
                breakdown: z.object({
                  priorityWeight: z.number().openapi({ example: 75 }),
                  goalBonus: z.number().openapi({ example: 20 }),
                  ageBonus: z.number().openapi({ example: 3 }),
                  typeBonus: z.number().openapi({ example: 50 }),
                }),
              })
            ),
            total: z.number().int().openapi({ example: 25 }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
})

// ─── Dashboard endpoints ──────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/dashboard/stats',
  tags: ['Dashboard'],
  summary: 'System health metrics',
  description: 'Returns aggregated issue counts by status/type, goal counts, and dispatch queue metrics.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Dashboard statistics',
      content: {
        'application/json': {
          schema: dataResponse(
            z.object({
              issues: z.object({
                total: z.number().int().openapi({ example: 120 }),
                byStatus: z.record(z.string(), z.number()).openapi({
                  example: { triage: 5, todo: 20, in_progress: 3, done: 92 },
                }),
                byType: z.record(z.string(), z.number()).openapi({
                  example: { signal: 30, task: 60, hypothesis: 20, plan: 8, monitor: 2 },
                }),
              }),
              goals: z.object({
                total: z.number().int().openapi({ example: 5 }),
                active: z.number().int().openapi({ example: 3 }),
                achieved: z.number().int().openapi({ example: 2 }),
              }),
              dispatch: z.object({
                queueDepth: z.number().int().openapi({ example: 20 }),
                activeCount: z.number().int().openapi({ example: 3 }),
                completedLast24h: z.number().int().openapi({ example: 12 }),
              }),
            })
          ),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/dashboard/activity',
  tags: ['Dashboard'],
  summary: 'Signal chains for activity timeline',
  description: 'Returns pre-assembled signal chains (root issues with children and relations), sorted by most recent activity.',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(200).default(20).openapi({ example: 20 }),
    }),
  },
  responses: {
    200: {
      description: 'Activity chains',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                root: IssueSchema,
                children: z.array(
                  z.object({
                    issue: IssueSchema,
                    relations: z.array(IssueRelationSchema),
                  })
                ),
                latestActivity: DateTimeSchema,
              })
            ),
            total: z.number().int().openapi({ example: 20 }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/dashboard/prompts',
  tags: ['Dashboard'],
  summary: 'Template health with scores',
  description: 'Returns all prompt templates with version history and aggregated review scores.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Prompt health data',
      content: {
        'application/json': {
          schema: dataResponse(
            z.array(
              z.object({
                template: PromptTemplateSchema,
                activeVersion: PromptVersionSchema.nullable(),
                recentVersions: z.array(PromptVersionSchema).openapi({ description: 'Last 5 versions' }),
                reviewSummary: z.object({
                  totalReviews: z.number().int().openapi({ example: 12 }),
                  avgClarity: z.number().nullable().openapi({ example: 4.1 }),
                  avgCompleteness: z.number().nullable().openapi({ example: 3.8 }),
                  avgRelevance: z.number().nullable().openapi({ example: 4.3 }),
                  compositeScore: z.number().nullable().openapi({ example: 4.07 }),
                }),
                needsAttention: z.boolean().openapi({ description: 'True when compositeScore < 3.0 or completionRate < 50%', example: false }),
              })
            )
          ),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
})

// ─── Webhook endpoints ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/signals/posthog',
  tags: ['Webhooks'],
  summary: 'PostHog metric alert webhook',
  description: 'Receives metric alert webhooks from PostHog. Authenticated via POSTHOG_WEBHOOK_SECRET in the Authorization header.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.record(z.string(), z.unknown()).openapi({ description: 'PostHog webhook payload' }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Webhook processed', content: { 'application/json': { schema: dataResponse(z.object({ signal: SignalSchema, issue: IssueSchema })) } } },
    400: { description: 'Bad request or payload parsing failure' },
    401: { description: 'Invalid PostHog webhook secret' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/signals/github',
  tags: ['Webhooks'],
  summary: 'GitHub events webhook',
  description: 'Receives GitHub events (push, pull_request, issues). Verified via HMAC-SHA256 signature using GITHUB_WEBHOOK_SECRET.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.record(z.string(), z.unknown()).openapi({ description: 'GitHub webhook payload' }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Webhook processed', content: { 'application/json': { schema: dataResponse(z.object({ signal: SignalSchema, issue: IssueSchema })) } } },
    400: { description: 'Bad request or signature mismatch' },
    401: { description: 'Invalid GitHub webhook signature' },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/signals/sentry',
  tags: ['Webhooks'],
  summary: 'Sentry error alert webhook',
  description: 'Receives Sentry error alerts. Verified via HMAC-SHA256 signature using SENTRY_CLIENT_SECRET.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.record(z.string(), z.unknown()).openapi({ description: 'Sentry webhook payload' }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Webhook processed', content: { 'application/json': { schema: dataResponse(z.object({ signal: SignalSchema, issue: IssueSchema })) } } },
    400: { description: 'Bad request or signature mismatch' },
    401: { description: 'Invalid Sentry webhook signature' },
  },
})

// ─── Document generator ───────────────────────────────────────────────────────

/**
 * Generate the complete OpenAPI 3.1 document from the registry.
 *
 * @returns OpenAPI 3.1 document object ready for serialization to JSON or YAML.
 */
export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Loop API',
      version: '0.1.0',
      description: 'The Loop Autonomous Improvement Engine API. Collects signals, organizes work into issues, and dispatches AI agents with hydrated prompts.',
      contact: {
        name: 'Loop by Dork Labs',
        url: 'https://www.looped.me',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      { url: 'http://localhost:4242', description: 'Local development' },
      { url: 'https://api.looped.me', description: 'Production' },
    ],
    tags: [
      { name: 'System', description: 'Health check and service info' },
      { name: 'Issues', description: 'Issue management — CRUD, labels' },
      { name: 'Relations', description: 'Issue relation management (blocks, relates_to, duplicates)' },
      { name: 'Comments', description: 'Issue comments (threaded)' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Goals', description: 'Goal tracking linked to projects' },
      { name: 'Labels', description: 'Label management' },
      { name: 'Signals', description: 'Signal ingestion from external tools' },
      { name: 'Templates', description: 'Prompt template management and versioning' },
      { name: 'Prompt Reviews', description: 'Quality reviews for prompt versions' },
      { name: 'Dispatch', description: 'AI agent work dispatch and queue preview' },
      { name: 'Dashboard', description: 'Aggregated system health metrics' },
      { name: 'Webhooks', description: 'Provider-specific inbound webhooks (PostHog, GitHub, Sentry)' },
    ],
  })
}
