import { describe, expect, it } from 'vitest'
import { generateOpenApiDocument } from '../lib/openapi-schemas'

// Generate the document once for all tests — it's a pure, side-effect-free
// function so sharing the result is safe and avoids redundant work.
const doc = generateOpenApiDocument()

// ─── Document generation ─────────────────────────────────────────────────────

describe('generateOpenApiDocument', () => {
  it('returns a non-null object', () => {
    expect(doc).toBeDefined()
    expect(typeof doc).toBe('object')
    expect(doc).not.toBeNull()
  })

  it('sets openapi version to 3.1.0', () => {
    expect(doc.openapi).toBe('3.1.0')
  })

  it('includes an info block with title and version', () => {
    expect(doc.info).toBeDefined()
    expect(typeof doc.info.title).toBe('string')
    expect(doc.info.title.length).toBeGreaterThan(0)
    expect(typeof doc.info.version).toBe('string')
    expect(doc.info.version.length).toBeGreaterThan(0)
  })

  it('includes at least one server', () => {
    expect(Array.isArray(doc.servers)).toBe(true)
    expect(doc.servers!.length).toBeGreaterThan(0)
  })

  it('includes a tags array with all expected groups', () => {
    const tagNames = doc.tags!.map((t) => t.name)
    const expectedTags = [
      'System',
      'Issues',
      'Relations',
      'Comments',
      'Projects',
      'Goals',
      'Labels',
      'Signals',
      'Templates',
      'Prompt Reviews',
      'Dispatch',
      'Dashboard',
      'Webhooks',
    ]
    for (const tag of expectedTags) {
      expect(tagNames).toContain(tag)
    }
  })
})

// ─── Path registration completeness ──────────────────────────────────────────

describe('registered paths', () => {
  const paths = doc.paths ?? {}

  it('has a non-empty paths object', () => {
    expect(Object.keys(paths).length).toBeGreaterThan(0)
  })

  it('each registered path has at least one HTTP method', () => {
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']
    for (const [path, item] of Object.entries(paths)) {
      const methods = Object.keys(item as object).filter((k) => httpMethods.includes(k))
      expect(methods.length, `Path "${path}" has no HTTP methods`).toBeGreaterThan(0)
    }
  })

  // Check each key API path group is present
  const requiredPaths: [string, string][] = [
    // System
    ['/health', 'get'],
    ['/', 'get'],
    // Issues
    ['/api/issues', 'get'],
    ['/api/issues', 'post'],
    ['/api/issues/{id}', 'get'],
    ['/api/issues/{id}', 'patch'],
    ['/api/issues/{id}', 'delete'],
    // Relations
    ['/api/issues/{id}/relations', 'post'],
    ['/api/relations/{id}', 'delete'],
    // Comments
    ['/api/issues/{id}/comments', 'get'],
    ['/api/issues/{id}/comments', 'post'],
    // Labels
    ['/api/labels', 'get'],
    ['/api/labels', 'post'],
    ['/api/labels/{id}', 'delete'],
    // Projects
    ['/api/projects', 'get'],
    ['/api/projects', 'post'],
    ['/api/projects/{id}', 'get'],
    ['/api/projects/{id}', 'patch'],
    ['/api/projects/{id}', 'delete'],
    // Goals
    ['/api/goals', 'get'],
    ['/api/goals', 'post'],
    ['/api/goals/{id}', 'get'],
    ['/api/goals/{id}', 'patch'],
    ['/api/goals/{id}', 'delete'],
    // Signals
    ['/api/signals', 'post'],
    // Templates
    ['/api/templates', 'get'],
    ['/api/templates', 'post'],
    ['/api/templates/{id}', 'get'],
    ['/api/templates/{id}', 'patch'],
    ['/api/templates/{id}', 'delete'],
    ['/api/templates/{id}/versions', 'get'],
    ['/api/templates/{id}/versions', 'post'],
    ['/api/templates/{id}/versions/{versionId}/promote', 'post'],
    ['/api/templates/{id}/reviews', 'get'],
    ['/api/templates/preview/{issueId}', 'get'],
    // Prompt reviews
    ['/api/prompt-reviews', 'post'],
    // Dispatch
    ['/api/dispatch/next', 'get'],
    ['/api/dispatch/queue', 'get'],
    // Dashboard
    ['/api/dashboard/stats', 'get'],
    ['/api/dashboard/activity', 'get'],
    ['/api/dashboard/prompts', 'get'],
    // Webhooks
    ['/api/signals/posthog', 'post'],
    ['/api/signals/github', 'post'],
    ['/api/signals/sentry', 'post'],
  ]

  for (const [path, method] of requiredPaths) {
    it(`registers ${method.toUpperCase()} ${path}`, () => {
      expect(paths[path], `Expected path "${path}" to be registered`).toBeDefined()
      const pathItem = paths[path] as Record<string, unknown>
      expect(pathItem[method], `Expected method "${method}" on "${path}"`).toBeDefined()
    })
  }
})

// ─── Component schemas ────────────────────────────────────────────────────────

describe('component schemas', () => {
  const schemas = (doc.components?.schemas ?? {}) as Record<string, unknown>

  const requiredSchemas = [
    'Issue',
    'Label',
    'IssueRelation',
    'Comment',
    'Goal',
    'Project',
    'Signal',
    'PromptTemplate',
    'PromptVersion',
    'PromptReview',
    'HypothesisData',
    'CommitRef',
    'PullRequestRef',
  ]

  for (const name of requiredSchemas) {
    it(`registers the "${name}" schema`, () => {
      expect(schemas[name], `Expected component schema "${name}" to be registered`).toBeDefined()
    })
  }

  it('registers bearerAuth security scheme', () => {
    const securitySchemes = (doc.components?.securitySchemes ?? {}) as Record<string, unknown>
    expect(securitySchemes['bearerAuth']).toBeDefined()
  })
})

// ─── Response structure ───────────────────────────────────────────────────────

describe('response structure', () => {
  const paths = doc.paths ?? {}

  /** Extracts the response status codes for a given path and method. */
  function getResponseCodes(path: string, method: string): string[] {
    const pathItem = (paths[path] ?? {}) as Record<string, unknown>
    const operation = (pathItem[method] ?? {}) as Record<string, unknown>
    const responses = (operation['responses'] ?? {}) as Record<string, unknown>
    return Object.keys(responses)
  }

  it('GET /api/issues returns 200', () => {
    expect(getResponseCodes('/api/issues', 'get')).toContain('200')
  })

  it('GET /api/projects returns 200', () => {
    expect(getResponseCodes('/api/projects', 'get')).toContain('200')
  })

  it('GET /api/goals returns 200', () => {
    expect(getResponseCodes('/api/goals', 'get')).toContain('200')
  })

  it('GET /api/labels returns 200', () => {
    expect(getResponseCodes('/api/labels', 'get')).toContain('200')
  })

  it('GET /api/templates returns 200', () => {
    expect(getResponseCodes('/api/templates', 'get')).toContain('200')
  })

  it('GET /api/dispatch/next returns 200', () => {
    expect(getResponseCodes('/api/dispatch/next', 'get')).toContain('200')
  })

  it('GET /api/dispatch/queue returns 200', () => {
    expect(getResponseCodes('/api/dispatch/queue', 'get')).toContain('200')
  })

  it('POST /api/issues returns 201', () => {
    expect(getResponseCodes('/api/issues', 'post')).toContain('201')
  })

  it('POST /api/projects returns 201', () => {
    expect(getResponseCodes('/api/projects', 'post')).toContain('201')
  })

  it('POST /api/goals returns 201', () => {
    expect(getResponseCodes('/api/goals', 'post')).toContain('201')
  })

  it('POST /api/labels returns 201', () => {
    expect(getResponseCodes('/api/labels', 'post')).toContain('201')
  })

  it('POST /api/signals returns 201', () => {
    expect(getResponseCodes('/api/signals', 'post')).toContain('201')
  })

  it('POST /api/templates returns 201', () => {
    expect(getResponseCodes('/api/templates', 'post')).toContain('201')
  })

  it('POST /api/prompt-reviews returns 201', () => {
    expect(getResponseCodes('/api/prompt-reviews', 'post')).toContain('201')
  })

  it('DELETE /api/issues/{id} returns 204', () => {
    expect(getResponseCodes('/api/issues/{id}', 'delete')).toContain('204')
  })

  it('DELETE /api/projects/{id} returns 204', () => {
    expect(getResponseCodes('/api/projects/{id}', 'delete')).toContain('204')
  })

  it('DELETE /api/goals/{id} returns 204', () => {
    expect(getResponseCodes('/api/goals/{id}', 'delete')).toContain('204')
  })

  it('DELETE /api/labels/{id} returns 204', () => {
    expect(getResponseCodes('/api/labels/{id}', 'delete')).toContain('204')
  })

  it('DELETE /api/templates/{id} returns 204', () => {
    expect(getResponseCodes('/api/templates/{id}', 'delete')).toContain('204')
  })

  it('DELETE /api/relations/{id} returns 204', () => {
    expect(getResponseCodes('/api/relations/{id}', 'delete')).toContain('204')
  })

  it('GET /api/dispatch/next also returns 204 for empty queue', () => {
    expect(getResponseCodes('/api/dispatch/next', 'get')).toContain('204')
  })
})
