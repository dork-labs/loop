import { describe, it, expect } from 'vitest';
import {
  matchesConditions,
  selectTemplate,
  compileTemplate,
  hydrateTemplate,
  initHandlebars,
  type IssueContext,
  type TemplateCandidate,
  type HydrationContext,
} from '../lib/prompt-engine';

const baseContext: IssueContext = {
  type: 'signal',
  signalSource: 'posthog',
  labels: ['frontend', 'urgent'],
  projectId: 'proj_1',
  hasFailedSessions: false,
  hypothesisConfidence: null,
};

describe('matchesConditions', () => {
  it('empty conditions match everything', () => {
    expect(matchesConditions({}, baseContext)).toBe(true);
  });

  it('single type condition matches correct type', () => {
    expect(matchesConditions({ type: 'signal' }, baseContext)).toBe(true);
    expect(matchesConditions({ type: 'task' }, baseContext)).toBe(false);
  });

  it('multiple conditions require all to match (AND)', () => {
    expect(matchesConditions({ type: 'signal', signalSource: 'posthog' }, baseContext)).toBe(true);
    expect(matchesConditions({ type: 'signal', signalSource: 'sentry' }, baseContext)).toBe(false);
  });

  it('labels condition requires all specified labels present', () => {
    expect(matchesConditions({ labels: ['frontend'] }, baseContext)).toBe(true);
    expect(matchesConditions({ labels: ['frontend', 'urgent'] }, baseContext)).toBe(true);
    expect(matchesConditions({ labels: ['backend'] }, baseContext)).toBe(false);
  });

  it('null context signalSource does not match signalSource condition', () => {
    const ctx: IssueContext = { ...baseContext, signalSource: null };
    expect(matchesConditions({ signalSource: 'posthog' }, ctx)).toBe(false);
  });

  it('null context projectId does not match projectId condition', () => {
    const ctx: IssueContext = { ...baseContext, projectId: null };
    expect(matchesConditions({ projectId: 'proj_1' }, ctx)).toBe(false);
  });

  it('hasFailedSessions exact match', () => {
    expect(matchesConditions({ hasFailedSessions: false }, baseContext)).toBe(true);
    expect(matchesConditions({ hasFailedSessions: true }, baseContext)).toBe(false);
  });

  it('hypothesisConfidence matches when context >= condition', () => {
    const ctx: IssueContext = { ...baseContext, hypothesisConfidence: 0.8 };
    expect(matchesConditions({ hypothesisConfidence: 0.7 }, ctx)).toBe(true);
    expect(matchesConditions({ hypothesisConfidence: 0.8 }, ctx)).toBe(true);
    expect(matchesConditions({ hypothesisConfidence: 0.9 }, ctx)).toBe(false);
  });

  it('hypothesisConfidence with null context does not match', () => {
    expect(matchesConditions({ hypothesisConfidence: 0.5 }, baseContext)).toBe(false);
  });
});

describe('selectTemplate', () => {
  const makeCandidate = (overrides: Partial<TemplateCandidate>): TemplateCandidate => ({
    id: 'tpl_1',
    slug: 'test',
    conditions: {},
    specificity: 10,
    projectId: null,
    activeVersionId: 'ver_1',
    ...overrides,
  });

  it('returns highest specificity match', () => {
    const templates = [
      makeCandidate({ id: 'low', slug: 'low', specificity: 10, conditions: { type: 'signal' } }),
      makeCandidate({
        id: 'high',
        slug: 'high',
        specificity: 50,
        conditions: { type: 'signal' },
      }),
    ];
    const result = selectTemplate(templates, baseContext);
    expect(result?.id).toBe('high');
  });

  it('project-specific template wins over higher-specificity generic', () => {
    const templates = [
      makeCandidate({
        id: 'generic',
        slug: 'generic',
        specificity: 100,
        conditions: { type: 'signal' },
      }),
      makeCandidate({
        id: 'proj',
        slug: 'proj',
        specificity: 10,
        projectId: 'proj_1',
        conditions: { type: 'signal' },
      }),
    ];
    const result = selectTemplate(templates, baseContext);
    expect(result?.id).toBe('proj');
  });

  it('returns null when no templates match', () => {
    const templates = [makeCandidate({ conditions: { type: 'task' } })];
    const result = selectTemplate(templates, baseContext);
    expect(result).toBeNull();
  });

  it('filters out templates without activeVersionId', () => {
    const templates = [makeCandidate({ activeVersionId: null, conditions: { type: 'signal' } })];
    const result = selectTemplate(templates, baseContext);
    expect(result).toBeNull();
  });

  it('returns null for empty template list', () => {
    const result = selectTemplate([], baseContext);
    expect(result).toBeNull();
  });
});

const mockContext: HydrationContext = {
  issue: { id: 'iss_1', title: 'Test Issue', number: 42, type: 'task', parentId: null },
  parent: null,
  siblings: [],
  children: [],
  project: null,
  goal: null,
  labels: [{ name: 'frontend', color: '#ff0000' }],
  blocking: [{ number: 45, title: 'Blocked Task' }],
  blockedBy: [],
  previousSessions: [],
  loopUrl: 'http://localhost:5667',
  loopToken: 'test-token',
  meta: {
    templateId: 'tpl_1',
    templateSlug: 'test-template',
    versionId: 'ver_1',
    versionNumber: 1,
  },
};

describe('hydrateTemplate', () => {
  it('injects issue variables', () => {
    const result = hydrateTemplate('v_inject', '# {{issue.title}}', mockContext);
    expect(result).toBe('# Test Issue');
  });

  it('renders conditional sections only when present', () => {
    const template = '{{#if parent}}Parent: {{parent.title}}{{/if}}No parent';
    const result = hydrateTemplate('v_cond', template, mockContext);
    expect(result).toBe('No parent');

    const withParent: HydrationContext = {
      ...mockContext,
      parent: { title: 'Parent Task', number: 1 },
    };
    const result2 = hydrateTemplate('v_cond2', template, withParent);
    expect(result2).toBe('Parent: Parent TaskNo parent');
  });

  it('iterates with each loops', () => {
    const ctx: HydrationContext = {
      ...mockContext,
      siblings: [
        { number: 1, status: 'todo', title: 'Sibling A' },
        { number: 2, status: 'done', title: 'Sibling B' },
      ] as Record<string, unknown>[],
    };
    const template = '{{#each siblings}}#{{this.number}} {{/each}}';
    const result = hydrateTemplate('v_each', template, ctx);
    expect(result).toBe('#1 #2 ');
  });

  it('renders json helper', () => {
    const ctx: HydrationContext = {
      ...mockContext,
      issue: { ...mockContext.issue, signalPayload: { key: 'value' } },
    };
    const template = '{{json issue.signalPayload}}';
    const result = hydrateTemplate('v_json', template, ctx);
    expect(result).toContain('"key": "value"');
  });

  it('renders partials', () => {
    const template = '{{> sibling_context}}';
    const ctx: HydrationContext = {
      ...mockContext,
      siblings: [{ number: 10, status: 'todo', title: 'Sib' }] as Record<string, unknown>[],
    };
    const result = hydrateTemplate('v_partial', template, ctx);
    expect(result).toContain('#10');
    expect(result).toContain('Sib');
  });

  it('renders without error when optional context is null/empty', () => {
    const template = '{{#if parent}}{{parent.title}}{{/if}}{{#if goal}}{{goal.title}}{{/if}}OK';
    const result = hydrateTemplate('v_missing', template, mockContext);
    expect(result).toBe('OK');
  });

  it('returns cached compiled template on second call', () => {
    const content = 'Hello {{issue.title}}';
    const compiled1 = compileTemplate('v_cache_test', content);
    const compiled2 = compileTemplate('v_cache_test', content);
    expect(compiled1).toBe(compiled2);
  });
});
