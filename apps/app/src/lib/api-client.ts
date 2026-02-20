import ky from 'ky'
import type { Issue, PaginatedResponse, Comment, Label } from '@/types/issues'
import type { Project, Goal } from '@/types/projects'
import type { PromptTemplate, PromptVersion, PromptReview } from '@/types/prompts'
import type { DashboardStats, DashboardActivity, DashboardPromptHealth } from '@/types/dashboard'

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4242',
  headers: {
    Authorization: `Bearer ${import.meta.env.VITE_LOOP_API_KEY}`,
  },
  hooks: {
    afterResponse: [
      async (_request, _options, response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? `API error: ${response.status}`)
        }
      },
    ],
  },
})

export const issuesApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/issues', { searchParams: params }).json<PaginatedResponse<Issue>>(),
  get: (id: string) =>
    api.get(`api/issues/${id}`).json<{ data: Issue }>(),
}

export const projectsApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/projects', { searchParams: params }).json<PaginatedResponse<Project>>(),
  get: (id: string) =>
    api.get(`api/projects/${id}`).json<{ data: Project }>(),
}

export const goalsApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/goals', { searchParams: params }).json<PaginatedResponse<Goal>>(),
  get: (id: string) =>
    api.get(`api/goals/${id}`).json<{ data: Goal }>(),
}

export const labelsApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/labels', { searchParams: params }).json<PaginatedResponse<Label>>(),
}

export const templatesApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/templates', { searchParams: params }).json<PaginatedResponse<PromptTemplate>>(),
  get: (id: string) =>
    api.get(`api/templates/${id}`).json<{ data: PromptTemplate }>(),
  versions: (id: string, params?: Record<string, string>) =>
    api.get(`api/templates/${id}/versions`, { searchParams: params }).json<PaginatedResponse<PromptVersion>>(),
  reviews: (id: string, params?: Record<string, string>) =>
    api.get(`api/templates/${id}/reviews`, { searchParams: params }).json<PaginatedResponse<PromptReview>>(),
}

export const dashboardApi = {
  stats: () =>
    api.get('api/dashboard/stats').json<{ data: DashboardStats }>(),
  activity: (params?: Record<string, string>) =>
    api.get('api/dashboard/activity', { searchParams: params }).json<{ data: DashboardActivity[]; total: number }>(),
  prompts: () =>
    api.get('api/dashboard/prompts').json<{ data: DashboardPromptHealth[] }>(),
}

// Re-export Comment type for external use without requiring consumers to import from types directly
export type { Comment }
