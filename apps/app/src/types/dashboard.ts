import type { IssueStatus, IssueType, Issue, IssueRelation } from './issues';
import type { PromptTemplate, PromptVersion } from './prompts';

/** Aggregated system-health metrics returned by `GET /api/dashboard/stats`. */
export interface DashboardStats {
  issues: {
    total: number;
    /** Count per status value. Keys are the full set of IssueStatus values. */
    byStatus: Record<IssueStatus, number>;
    /** Count per type value. Keys are the full set of IssueType values. */
    byType: Record<IssueType, number>;
  };
  goals: {
    total: number;
    active: number;
    achieved: number;
  };
  /**
   * Dispatch-queue health metrics derived from issue status counts.
   * queueDepth = issues in 'todo' or 'backlog' status.
   * activeCount = issues in 'in_progress' status.
   */
  dispatch: {
    queueDepth: number;
    activeCount: number;
    completedLast24h: number;
  };
}

/**
 * A pre-assembled signal chain returned by `GET /api/dashboard/activity`.
 * The root is a top-level issue (parentId IS NULL); children are its direct
 * descendants ordered by creation time, each accompanied by their relations.
 */
export interface DashboardActivity {
  root: Issue;
  children: Array<{
    issue: Issue;
    relations: IssueRelation[];
  }>;
  /** ISO timestamp of the most recent updatedAt across root and all children. */
  latestActivity: string;
}

/**
 * Prompt template health data returned by `GET /api/dashboard/prompts`.
 * Aggregates review scores and flags templates that need attention.
 */
export interface DashboardPromptHealth {
  template: PromptTemplate;
  activeVersion: PromptVersion | null;
  /** Up to the last 5 versions ordered by version number descending. */
  recentVersions: PromptVersion[];
  reviewSummary: {
    totalReviews: number;
    avgClarity: number | null;
    avgCompleteness: number | null;
    avgRelevance: number | null;
    /**
     * Composite quality score sourced from the active version's `reviewScore`
     * (EWMA-smoothed). Null if no active version or no reviews yet.
     */
    compositeScore: number | null;
  };
  /**
   * True when compositeScore < 3.0 or completionRate < 0.5, indicating the
   * template requires human review.
   */
  needsAttention: boolean;
}

/** Generic single-item response envelope. */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Alias for {@link DashboardActivity} — used by `api-client.ts`.
 * @see DashboardActivity
 */
export type ActivityChain = DashboardActivity;

/**
 * Alias for {@link DashboardPromptHealth} — used by `api-client.ts`.
 * @see DashboardPromptHealth
 */
export type PromptHealth = DashboardPromptHealth;
