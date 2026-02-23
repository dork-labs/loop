import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type PaginationState,
} from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { issueColumns } from './columns';
import { Route } from '@/routes/_dashboard/issues/index';
import type { Issue } from '@/types/issues';

// Number of skeleton rows to show during initial load
const SKELETON_ROW_COUNT = 8;

interface IssueDataTableProps {
  data: Issue[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
}

/** Renders the issues data table with manual server-side pagination. */
export function IssueDataTable({ data, total, page, limit, isLoading }: IssueDataTableProps) {
  const navigate = useNavigate({ from: Route.fullPath });

  const pagination: PaginationState = {
    pageIndex: page - 1,
    pageSize: limit,
  };

  const table = useReactTable({
    data,
    columns: issueColumns,
    pageCount: Math.ceil(total / limit),
    state: { pagination },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      void navigate({
        search: (prev) => ({
          ...prev,
          page: next.pageIndex + 1,
          limit: next.pageSize,
        }),
      });
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, total);

  if (isLoading) {
    return <IssueTableSkeleton />;
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={
                    header.column.columnDef.size
                      ? { width: header.column.columnDef.size }
                      : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <IssueRow key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>

      {/* Pagination bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-muted-foreground text-sm">
          {total === 0 ? 'No results' : `Showing ${pageStart}–${pageEnd} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface IssueRowProps {
  row: ReturnType<ReturnType<typeof useReactTable<Issue>>['getRowModel']>['rows'][number];
}

function IssueRow({ row }: IssueRowProps) {
  const navigate = useNavigate();
  const issue = row.original;

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => void navigate({ to: '/issues/$issueId', params: { issueId: issue.id } })}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

function IssueTableSkeleton() {
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {['#', 'Title', 'Type', 'Status', 'Priority', 'Project', 'Labels', 'Updated'].map(
              (col) => (
                <TableHead key={col}>{col}</TableHead>
              )
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-64" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-6" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-14" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
