import type {
  IssueType,
  IssueStatus,
  ProjectStatus,
  ProjectHealth,
  GoalStatus,
  SignalSeverity,
  RelationType,
  AuthorType,
  VersionStatus,
} from './enums';
import type {
  HypothesisData,
  CommitRef,
  PullRequestRef,
  SignalPayload,
  TemplateConditions,
} from './jsonb';

export interface Issue {
  id: string;
  number: number;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: number;
  parentId: string | null;
  projectId: string | null;
  signalSource: string | null;
  signalPayload: SignalPayload | null;
  hypothesis: HypothesisData | null;
  agentSessionId: string | null;
  agentSummary: string | null;
  commits: CommitRef[] | null;
  pullRequests: PullRequestRef[] | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface IssueDetail extends Issue {
  parent: Issue | null;
  children: Issue[];
  labels: Label[];
  relations: IssueRelation[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProjectDetail extends Project {
  goal: Goal | null;
  issueCounts: Record<IssueStatus, number>;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  metric: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  status: GoalStatus;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface IssueRelation {
  id: string;
  type: RelationType;
  issueId: string;
  relatedIssueId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  body: string;
  issueId: string;
  authorName: string;
  authorType: AuthorType;
  parentId: string | null;
  createdAt: string;
}

export interface Signal {
  id: string;
  source: string;
  sourceId: string | null;
  type: string;
  severity: SignalSeverity;
  payload: SignalPayload;
  issueId: string;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  conditions: TemplateConditions;
  specificity: number;
  projectId: string | null;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  version: number;
  content: string;
  changelog: string | null;
  authorType: AuthorType;
  authorName: string;
  status: VersionStatus;
  usageCount: number;
  completionRate: number | null;
  avgDurationMs: number | null;
  reviewScore: number | null;
  createdAt: string;
}

export interface PromptReview {
  id: string;
  versionId: string;
  issueId: string;
  clarity: number;
  completeness: number;
  relevance: number;
  feedback: string | null;
  authorType: AuthorType;
  createdAt: string;
}
