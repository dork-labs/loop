import { createFileRoute } from '@tanstack/react-router';
import { zodValidator, fallback } from '@tanstack/zod-adapter';
import { z } from 'zod';

const issueSearchSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  projectId: z.string().optional(),
  labelId: z.string().optional(),
  priority: z.coerce.number().optional(),
  page: fallback(z.coerce.number(), 1).default(1),
  limit: fallback(z.coerce.number(), 50).default(50),
});

export const Route = createFileRoute('/_dashboard/issues/')({
  validateSearch: zodValidator(issueSearchSchema),
  // Component is loaded lazily via index.lazy.tsx for code splitting.
});
