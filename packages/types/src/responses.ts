import type { Issue, IssueRelation, Signal, PromptTemplate, PromptVersion } from './entities';
import type { IssueStatus, IssueType } from './enums';

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

export interface SignalIngestResponse {
  signal: Signal;
  issue: Issue;
}

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

export interface TemplateDetail extends PromptTemplate {
  activeVersion: PromptVersion | null;
}

export interface TemplatePreview {
  issue: Pick<Issue, 'id' | 'number' | 'title' | 'type'>;
  template: PromptTemplate | null;
  version: Pick<PromptVersion, 'id' | 'version'> | null;
  prompt: string | null;
  message?: string;
}
