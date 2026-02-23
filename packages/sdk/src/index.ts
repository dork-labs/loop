/**
 * @dork-labs/loop-sdk — TypeScript SDK for the Loop API.
 *
 * @module @dork-labs/loop-sdk
 */

// Main client
export { LoopClient } from './client';
export type { LoopClientOptions } from './http';

// HTTP utilities
export type { HttpClient, RequestOptions } from './http';

// Pagination
export { PaginatedList, paginate } from './pagination';

// Errors
export {
  LoopError,
  LoopNotFoundError,
  LoopValidationError,
  LoopConflictError,
  LoopRateLimitError,
} from './errors';

// Resources
export { IssuesResource } from './resources/issues';
export { ProjectsResource } from './resources/projects';
export { GoalsResource } from './resources/goals';
export { LabelsResource } from './resources/labels';
export { SignalsResource } from './resources/signals';
export { CommentsResource } from './resources/comments';
export { RelationsResource } from './resources/relations';
export { TemplatesResource } from './resources/templates';
export { ReviewsResource } from './resources/reviews';
export { DashboardResource } from './resources/dashboard';
export { DispatchResource } from './resources/dispatch';

// Re-export all types from @dork-labs/loop-types for convenience
export * from '@dork-labs/loop-types';
