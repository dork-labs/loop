import type { HttpClient } from '../http';
import { toSearchParams } from '../http';
import type {
  DashboardStats,
  DashboardActivityItem,
  DashboardPromptHealth,
  PaginationParams,
  DataResponse,
} from '@dork-labs/loop-types';

/**
 * Dashboard resource — system health metrics and activity overview.
 * Provides read-only views into Loop's operational state.
 */
export class DashboardResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get system health metrics including issue counts, goal progress, and dispatch stats.
   */
  async stats(): Promise<DashboardStats> {
    const response = await this.http
      .get('api/dashboard/stats')
      .json<DataResponse<DashboardStats>>();
    return response.data;
  }

  /**
   * Get signal chains for the activity timeline.
   * Returns root signals with their child issues and relations.
   *
   * @param params - Pagination params
   */
  async activity(params?: PaginationParams): Promise<DashboardActivityItem[]> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/dashboard/activity', { searchParams })
      .json<DataResponse<DashboardActivityItem[]>>();
    return response.data;
  }

  /**
   * Get template health with review scores and attention flags.
   */
  async prompts(): Promise<DashboardPromptHealth[]> {
    const response = await this.http
      .get('api/dashboard/prompts')
      .json<DataResponse<DashboardPromptHealth[]>>();
    return response.data;
  }
}
