import { createHttpClient, type LoopClientOptions } from './http';
import { IssuesResource } from './resources/issues';
import { ProjectsResource } from './resources/projects';
import { GoalsResource } from './resources/goals';
import { LabelsResource } from './resources/labels';
import { SignalsResource } from './resources/signals';
import { CommentsResource } from './resources/comments';
import { RelationsResource } from './resources/relations';
import { TemplatesResource } from './resources/templates';
import { ReviewsResource } from './resources/reviews';
import { DashboardResource } from './resources/dashboard';
import { DispatchResource } from './resources/dispatch';

export type { LoopClientOptions };

/**
 * LoopClient — the main entry point for the Loop SDK.
 *
 * Instantiate once with your API key and use the resource properties
 * to interact with the Loop API.
 *
 * @example
 * ```typescript
 * import { LoopClient } from '@dork-labs/loop-sdk'
 *
 * const loop = new LoopClient({ apiKey: 'loop_abc123' })
 *
 * const task = await loop.dispatch.next()
 * if (task) {
 *   console.log(task.issue.title)
 *   console.log(task.prompt)
 * }
 * ```
 */
export class LoopClient {
  /** Core agent feedback loop — claim and preview prioritised work. */
  readonly dispatch: DispatchResource;

  /** Issues — the atomic unit of work in Loop. */
  readonly issues: IssuesResource;

  /** Projects — group issues toward a shared objective. */
  readonly projects: ProjectsResource;

  /** Goals — measurable success indicators attached to projects. */
  readonly goals: GoalsResource;

  /** Labels — categorical tags for issues. */
  readonly labels: LabelsResource;

  /** Signals — ingest external events into the Loop pipeline. */
  readonly signals: SignalsResource;

  /** Comments — threaded discussion on issues. */
  readonly comments: CommentsResource;

  /** Relations — blocking/related dependencies between issues. */
  readonly relations: RelationsResource;

  /** Templates — versioned prompt instructions for the dispatch engine. */
  readonly templates: TemplatesResource;

  /** Reviews — agent and human quality feedback on prompt versions. */
  readonly reviews: ReviewsResource;

  /** Dashboard — system health metrics and activity overview. */
  readonly dashboard: DashboardResource;

  constructor(options: LoopClientOptions) {
    const http = createHttpClient(options);

    this.dispatch = new DispatchResource(http);
    this.issues = new IssuesResource(http);
    this.projects = new ProjectsResource(http);
    this.goals = new GoalsResource(http);
    this.labels = new LabelsResource(http);
    this.signals = new SignalsResource(http);
    this.comments = new CommentsResource(http);
    this.relations = new RelationsResource(http);
    this.templates = new TemplatesResource(http);
    this.reviews = new ReviewsResource(http);
    this.dashboard = new DashboardResource(http);
  }
}
