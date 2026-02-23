import { Link, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { List, Activity, Target, Sparkles, Orbit, Keyboard } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { dashboardStatsOptions } from '@/lib/queries/dashboard';
import type { DashboardStats } from '@/types/dashboard';

/** Resolve the live badge count for a nav item from dashboard stats, if applicable. */
function resolveNavBadge(to: string, stats: DashboardStats | undefined): number | undefined {
  if (!stats) return undefined;
  if (to === '/issues') return stats.issues.total;
  if (to === '/goals') return stats.goals.active;
  return undefined;
}

const NAV_ITEMS = [
  { title: 'Issues', to: '/issues', icon: List },
  { title: 'Activity', to: '/activity', icon: Activity },
  { title: 'Goals', to: '/goals', icon: Target },
  { title: 'Prompts', to: '/prompts', icon: Sparkles },
] as const;

/** Sidebar navigation with live dispatch-queue stats from the dashboard API. */
export function AppSidebar() {
  const router = useRouterState();
  const { data: stats } = useQuery(dashboardStatsOptions());

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <Orbit className="text-muted-foreground size-5" />
          <span className="text-lg font-bold">Loop</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const badge = resolveNavBadge(item.to, stats);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={router.location.pathname.startsWith(item.to)}
                    >
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badge !== undefined && badge > 0 && (
                      <SidebarMenuBadge>{badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Separator />
        <div className="text-muted-foreground flex items-center gap-1.5 px-4 py-1 text-xs">
          <Keyboard className="size-3" />
          <span>
            Press <kbd className="border-border rounded border px-1 font-mono text-[10px]">?</kbd>{' '}
            for shortcuts
          </span>
        </div>
        <Separator />
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="text-muted-foreground space-y-1 px-2 text-sm">
              <div className="flex justify-between">
                <span>Queue</span>
                <span className="font-mono">{stats?.dispatch.queueDepth ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Active</span>
                <span className="font-mono">{stats?.dispatch.activeCount ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Done (24h)</span>
                <span className="font-mono">{stats?.dispatch.completedLast24h ?? '—'}</span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
