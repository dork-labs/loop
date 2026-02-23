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

export interface CreateLabelParams {
  name: string;
  color: string;
}

export interface IngestSignalParams {
  source: string;
  sourceId?: string;
  type: string;
  severity: SignalSeverity;
  payload: SignalPayload;
  projectId?: string;
}

export interface CreateCommentParams {
  body: string;
  authorName: string;
  authorType: AuthorType;
  parentId?: string;
}

export interface CreateRelationParams {
  type: RelationType;
  relatedIssueId: string;
}

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

export interface CreateVersionParams {
  content: string;
  changelog?: string;
  authorType: AuthorType;
  authorName: string;
}

export interface CreateReviewParams {
  versionId: string;
  issueId: string;
  clarity: number;
  completeness: number;
  relevance: number;
  feedback?: string;
  authorType: AuthorType;
}

export interface DispatchNextParams {
  projectId?: string;
}

export interface DispatchQueueParams {
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}
