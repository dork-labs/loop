import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Route } from '@/routes/_dashboard/issues/index';
import { projectListOptions } from '@/lib/queries/projects';
import { labelListOptions } from '@/lib/queries/labels';
import type { IssueStatus, IssueType } from '@/types/issues';

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'triage', label: 'Triage' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

const TYPE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: 'signal', label: 'Signal' },
  { value: 'hypothesis', label: 'Hypothesis' },
  { value: 'plan', label: 'Plan' },
  { value: 'task', label: 'Task' },
  { value: 'monitor', label: 'Monitor' },
];

const PRIORITY_OPTIONS = [
  { value: '0', label: 'P0 — Critical' },
  { value: '1', label: 'P1 — High' },
  { value: '2', label: 'P2 — Medium' },
  { value: '3', label: 'P3 — Low' },
  { value: '4', label: 'P4 — Minimal' },
];

/** Filter bar for the issue list — all filter state lives in URL search params. */
export function IssueFilters() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  const { data: projectsData } = useQuery(projectListOptions());
  const { data: labelsData } = useQuery(labelListOptions());

  const FILTER_KEYS = ['status', 'type', 'priority', 'projectId', 'labelId'] as const;
  const activeFilterCount = FILTER_KEYS.filter((key) => search[key] !== undefined).length;

  function setFilter(key: string, value: string | undefined) {
    void navigate({
      search: (prev) => ({
        ...prev,
        [key]: value,
        page: 1,
      }),
    });
  }

  function clearAllFilters() {
    void navigate({
      search: { page: 1, limit: search.limit },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status filter */}
      <Select
        value={search.status ?? ''}
        onValueChange={(v) => setFilter('status', v === 'all' ? undefined : v)}
      >
        <SelectTrigger size="sm" className="w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type filter */}
      <Select
        value={search.type ?? ''}
        onValueChange={(v) => setFilter('type', v === 'all' ? undefined : v)}
      >
        <SelectTrigger size="sm" className="w-[130px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select
        value={search.priority !== undefined ? String(search.priority) : ''}
        onValueChange={(v) => setFilter('priority', v === 'all' ? undefined : v)}
      >
        <SelectTrigger size="sm" className="w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Project filter */}
      {projectsData && projectsData.data.length > 0 && (
        <Select
          value={search.projectId ?? ''}
          onValueChange={(v) => setFilter('projectId', v === 'all' ? undefined : v)}
        >
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projectsData.data.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Label filter */}
      {labelsData && labelsData.data.length > 0 && (
        <Select
          value={search.labelId ?? ''}
          onValueChange={(v) => setFilter('labelId', v === 'all' ? undefined : v)}
        >
          <SelectTrigger size="sm" className="w-[130px]">
            <SelectValue placeholder="Label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All labels</SelectItem>
            {labelsData.data.map((label) => (
              <SelectItem key={label.id} value={label.id}>
                {label.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="text-muted-foreground h-8 gap-1"
        >
          <X className="size-3" />
          Clear
          <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-xs">
            {activeFilterCount}
          </Badge>
        </Button>
      )}
    </div>
  );
}
