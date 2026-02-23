import Handlebars from 'handlebars';
import { z } from 'zod';
import { eq, and, ne, isNull } from 'drizzle-orm';
import {
  issueTypeValues,
  issues,
  projects,
  goals,
  issueLabels,
  labels,
  issueRelations,
} from '../db/schema';
import { PARTIALS } from './partials';
import { env } from '../env';
import type { AnyDb } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Validated condition keys stored in template.conditions JSONB */
export interface TemplateConditions {
  type?: string;
  signalSource?: string;
  labels?: string[];
  projectId?: string;
  hasFailedSessions?: boolean;
  hypothesisConfidence?: number;
}

/** Context built from an issue for template matching */
export interface IssueContext {
  type: string;
  signalSource: string | null;
  labels: string[];
  projectId: string | null;
  hasFailedSessions: boolean;
  hypothesisConfidence: number | null;
}

// ─── Zod Schema ──────────────────────────────────────────────────────────────

export const TemplateConditionsSchema = z
  .object({
    type: z.enum(issueTypeValues).optional(),
    signalSource: z.string().optional(),
    labels: z.array(z.string()).optional(),
    projectId: z.string().optional(),
    hasFailedSessions: z.boolean().optional(),
    hypothesisConfidence: z.number().min(0).max(1).optional(),
  })
  .strict();

// ─── Selection Algorithm ─────────────────────────────────────────────────────

/**
 * Check if a template's conditions match the given issue context.
 * Empty conditions {} matches everything.
 * All specified conditions must match (AND logic).
 */
export function matchesConditions(conditions: TemplateConditions, context: IssueContext): boolean {
  if (conditions.type !== undefined && conditions.type !== context.type) {
    return false;
  }
  if (conditions.signalSource !== undefined) {
    if (context.signalSource === null || conditions.signalSource !== context.signalSource) {
      return false;
    }
  }
  if (conditions.labels !== undefined) {
    if (!conditions.labels.every((label) => context.labels.includes(label))) {
      return false;
    }
  }
  if (conditions.projectId !== undefined) {
    if (context.projectId === null || conditions.projectId !== context.projectId) {
      return false;
    }
  }
  if (conditions.hasFailedSessions !== undefined) {
    if (conditions.hasFailedSessions !== context.hasFailedSessions) {
      return false;
    }
  }
  if (conditions.hypothesisConfidence !== undefined) {
    if (
      context.hypothesisConfidence === null ||
      context.hypothesisConfidence < conditions.hypothesisConfidence
    ) {
      return false;
    }
  }
  return true;
}

export interface TemplateCandidate {
  id: string;
  slug: string;
  conditions: TemplateConditions;
  specificity: number;
  projectId: string | null;
  activeVersionId: string | null;
}

/**
 * Select the best matching template for an issue context.
 *
 * 1. Filter to templates where conditions match the context
 * 2. Filter to templates with a non-null activeVersionId
 * 3. Sort: project-specific first, then by specificity descending
 * 4. Return first match, or null
 */
export function selectTemplate(
  templates: TemplateCandidate[],
  context: IssueContext
): TemplateCandidate | null {
  const matching = templates
    .filter((t) => t.activeVersionId !== null)
    .filter((t) => matchesConditions(t.conditions, context))
    .sort((a, b) => {
      // Project-specific templates first
      const aProjectMatch = a.projectId === context.projectId && a.projectId !== null ? 1 : 0;
      const bProjectMatch = b.projectId === context.projectId && b.projectId !== null ? 1 : 0;
      if (aProjectMatch !== bProjectMatch) return bProjectMatch - aProjectMatch;
      // Then by specificity descending
      return b.specificity - a.specificity;
    });

  return matching[0] ?? null;
}

// ─── Hydration Types ──────────────────────────────────────────────────────────

export interface HydrationContext {
  issue: Record<string, unknown>;
  parent: Record<string, unknown> | null;
  siblings: Record<string, unknown>[];
  children: Record<string, unknown>[];
  project: Record<string, unknown> | null;
  goal: Record<string, unknown> | null;
  labels: Array<{ name: string; color: string }>;
  blocking: Array<{ number: number; title: string }>;
  blockedBy: Array<{ number: number; title: string }>;
  previousSessions: Array<{ status: string; agentSummary: string | null }>;
  loopUrl: string;
  loopToken: string;
  meta: {
    templateId: string;
    templateSlug: string;
    versionId: string;
    versionNumber: number;
  };
}

// ─── Handlebars Setup ─────────────────────────────────────────────────────────

/** Compiled template cache, keyed by version ID */
const templateCache = new Map<string, Handlebars.TemplateDelegate>();

/** Register shared partials and helpers. Call once at module load. */
export function initHandlebars(): void {
  // Register all shared partials
  for (const [name, content] of Object.entries(PARTIALS)) {
    Handlebars.registerPartial(name, content);
  }

  // Register json helper for rendering JSONB fields
  Handlebars.registerHelper('json', (ctx: unknown) => JSON.stringify(ctx, null, 2));

  // Register priority_label helper mapping priority int to human label
  Handlebars.registerHelper('priority_label', (priority: number) => {
    const labels: Record<number, string> = {
      1: 'urgent',
      2: 'high',
      3: 'medium',
      4: 'low',
      0: 'none',
    };
    return labels[priority] ?? 'unknown';
  });
}

// Initialize at module load
initHandlebars();

/**
 * Compile a Handlebars template with caching by version ID.
 * Uses strict: false so templates render gracefully when optional context is missing.
 * Uses noEscape: true because prompts are plain text, not HTML.
 */
export function compileTemplate(versionId: string, content: string): Handlebars.TemplateDelegate {
  const cached = templateCache.get(versionId);
  if (cached) return cached;
  const compiled = Handlebars.compile(content, { strict: false, noEscape: true });
  templateCache.set(versionId, compiled);
  return compiled;
}

/**
 * Hydrate a template version with the full context.
 * Compiles (or retrieves from cache) and renders with the provided context.
 */
export function hydrateTemplate(
  versionId: string,
  content: string,
  context: HydrationContext
): string {
  const compiled = compileTemplate(versionId, content);
  return compiled(context);
}

// ─── Context Assembly ─────────────────────────────────────────────────────────

/**
 * Assemble the full HydrationContext for a given issue from the database.
 * Runs parallel queries via Promise.all where possible to minimize latency.
 *
 * @param db - Driver-agnostic Drizzle database instance
 * @param issue - The issue row to build context for
 * @param template - Template identity (id + slug) for meta
 * @param version - Version identity (id + version number) for meta
 */
export async function buildHydrationContext(
  db: AnyDb,
  issue: typeof issues.$inferSelect,
  template: { id: string; slug: string },
  version: { id: string; version: number }
): Promise<HydrationContext> {
  const [parentResult, labelResults, blockingResults, blockedByResults] = await Promise.all([
    issue.parentId
      ? db.select().from(issues).where(eq(issues.id, issue.parentId))
      : Promise.resolve([]),
    db
      .select({ name: labels.name, color: labels.color })
      .from(issueLabels)
      .innerJoin(labels, eq(issueLabels.labelId, labels.id))
      .where(eq(issueLabels.issueId, issue.id)),
    db
      .select({ id: issues.id, number: issues.number, title: issues.title })
      .from(issueRelations)
      .innerJoin(issues, eq(issueRelations.relatedIssueId, issues.id))
      .where(and(eq(issueRelations.issueId, issue.id), eq(issueRelations.type, 'blocks'))),
    db
      .select({ id: issues.id, number: issues.number, title: issues.title })
      .from(issueRelations)
      .innerJoin(issues, eq(issueRelations.relatedIssueId, issues.id))
      .where(and(eq(issueRelations.issueId, issue.id), eq(issueRelations.type, 'blocked_by'))),
  ]);

  const [siblingsOrChildren, projectResult] = await Promise.all([
    issue.parentId
      ? db
          .select()
          .from(issues)
          .where(
            and(
              eq(issues.parentId, issue.parentId!),
              ne(issues.id, issue.id),
              isNull(issues.deletedAt)
            )
          )
      : db
          .select()
          .from(issues)
          .where(and(eq(issues.parentId, issue.id), isNull(issues.deletedAt))),
    issue.projectId
      ? db.select().from(projects).where(eq(projects.id, issue.projectId))
      : Promise.resolve([]),
  ]);

  const parent = parentResult[0] ?? null;
  const project = projectResult[0] ?? null;

  let goal = null;
  if (project) {
    const [goalResult] = await db.select().from(goals).where(eq(goals.projectId, project.id));
    goal = goalResult ?? null;
  }

  const previousSessions: Array<{ status: string; agentSummary: string | null }> = [];
  if (issue.agentSummary) {
    previousSessions.push({ status: issue.status, agentSummary: issue.agentSummary });
  }

  const siblings = issue.parentId ? siblingsOrChildren : [];
  const children = issue.parentId ? [] : siblingsOrChildren;

  return {
    issue: issue as unknown as Record<string, unknown>,
    parent: parent as Record<string, unknown> | null,
    siblings: siblings as Record<string, unknown>[],
    children: children as Record<string, unknown>[],
    project: project as Record<string, unknown> | null,
    goal: goal as Record<string, unknown> | null,
    labels: labelResults,
    blocking: blockingResults,
    blockedBy: blockedByResults,
    previousSessions,
    loopUrl: env.LOOP_URL,
    loopToken: env.LOOP_API_KEY,
    meta: {
      templateId: template.id,
      templateSlug: template.slug,
      versionId: version.id,
      versionNumber: version.version,
    },
  };
}
