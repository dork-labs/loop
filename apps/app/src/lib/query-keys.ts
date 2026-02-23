export const queryKeys = {
  issues: {
    all: ['issues'] as const,
    lists: () => [...queryKeys.issues.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.issues.lists(), filters] as const,
    details: () => [...queryKeys.issues.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.issues.details(), id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: () => [...queryKeys.projects.all, 'list'] as const,
  },
  goals: {
    all: ['goals'] as const,
    list: () => [...queryKeys.goals.all, 'list'] as const,
  },
  labels: {
    all: ['labels'] as const,
    list: () => [...queryKeys.labels.all, 'list'] as const,
  },
  templates: {
    all: ['templates'] as const,
    list: () => [...queryKeys.templates.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.templates.all, 'detail', id] as const,
    versions: (id: string) => [...queryKeys.templates.all, 'versions', id] as const,
    reviews: (id: string) => [...queryKeys.templates.all, 'reviews', id] as const,
  },
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    activity: ['dashboard', 'activity'] as const,
    prompts: ['dashboard', 'prompts'] as const,
  },
} as const;
