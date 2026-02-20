import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_dashboard/prompts/')({
  // Component is loaded lazily via index.lazy.tsx for code splitting.
  // This ensures Recharts (a large dependency) is not included in the main bundle.
})
