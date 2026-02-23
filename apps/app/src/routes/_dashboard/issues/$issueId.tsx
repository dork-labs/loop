import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/issues/$issueId')({
  // Component is loaded lazily via $issueId.lazy.tsx for code splitting.
});
