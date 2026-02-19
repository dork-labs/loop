# Loop

The Autonomous Improvement Engine.

An open-source data layer and prompt engine that collects signals, organizes work
into issues, and tells AI agents exactly what to do next.

## Tech Stack

- **API:** Hono (TypeScript)
- **Database:** PostgreSQL + Drizzle ORM
- **Frontend:** React 19 + Vite + Tailwind CSS + shadcn/ui
- **Marketing:** Next.js 16 + Fumadocs
- **Monorepo:** Turborepo

## Getting Started

npm install
npm run dev

## Structure

apps/
  api/     # Hono API (app.looped.me)
  app/     # React dashboard (app.looped.me)
  web/     # Marketing site (www.looped.me)
