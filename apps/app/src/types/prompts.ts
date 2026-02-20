import type { AuthorType } from './issues'

/**
 * Discriminated union values matching the `prompt_version_status` postgres enum.
 * Note: the DB uses 'retired' (not 'archived') for superseded versions.
 */
export type VersionStatus = 'draft' | 'active' | 'retired'

/**
 * A named, versioned prompt template.
 * `conditions` is a JSONB object controlling when this template is selected
 * by the dispatch engine; `specificity` is the tie-breaking score (higher wins).
 */
export interface PromptTemplate {
  id: string
  slug: string
  name: string
  description: string | null
  conditions: Record<string, unknown>
  specificity: number
  projectId: string | null
  activeVersionId: string | null
  createdAt: string
  updatedAt: string
  /** Populated on detail responses that join the active version row. */
  activeVersion?: PromptVersion | null
}

/**
 * An immutable content snapshot of a prompt template.
 * `content` holds the Handlebars template body.
 * `reviewScore` is the EWMA composite quality score (1–5 scale), or null
 * if no reviews have been submitted for this version yet.
 */
export interface PromptVersion {
  id: string
  templateId: string
  version: number
  status: VersionStatus
  content: string
  changelog: string | null
  authorType: AuthorType
  authorName: string
  usageCount: number
  completionRate: number | null
  avgDurationMs: number | null
  reviewScore: number | null
  createdAt: string
}

/**
 * A quality review for a specific prompt version, submitted by a human or agent
 * after completing an issue using that prompt.
 * All three dimension scores (clarity, completeness, relevance) are integers 1–5.
 */
export interface PromptReview {
  id: string
  versionId: string
  issueId: string
  clarity: number
  completeness: number
  relevance: number
  feedback: string | null
  authorType: AuthorType
  createdAt: string
}
