# Developer Setup & Onboarding Patterns in Open Source Projects

**Date:** 2026-02-21
**Mode:** Deep Research
**Searches performed:** 16
**Primary sources:** create-t3-app, Documenso, Cal.com, Supabase, Formbricks, Payload CMS, Appwrite, t3-env

---

## Research Summary

The most effective open source projects reduce time-to-first-run through a small number of high-leverage automations: a `docker compose up` command that spins up all backing services, env validation that fails loudly at startup with specific variable names, and a one-step `.env` initialization. The best DX gains come from composing three cheap things — a `docker-compose.dev.yml`, a `cp .env.example .env` with pre-filled safe defaults, and Zod env validation — not from building interactive CLI wizards. For a 3-app Turborepo with a PostgreSQL database, these patterns apply directly and with very little complexity.

---

## Key Findings

### 1. CLI Setup Wizards: High Complexity, Best for Generators

CLI wizards like `npx create-t3-app` are scaffolding tools, not dev-environment tools. They work once, at project creation, and are not appropriate for ongoing developer onboarding.

**How create-t3-app works:**

- Uses **Commander.js** for argument parsing and **@clack/prompts** for interactive terminal UI
- Uses **execa** to run package manager commands and **fs-extra** for file operations
- Prompts are conditional: later questions only appear based on earlier answers
- Final output: a generated project from a template directory plus conditionally copied extras
- Key questions: project name, TypeScript, Tailwind, tRPC, NextAuth, Drizzle/Prisma, database type, ESLint/Biome, git init, dependency install

**How create-payload-app works:**

- Templates: blank, website, ecommerce, plugin
- Flags: `-n` (name), `-t` (template), `--use-npm/yarn/pnpm`
- Creates Payload config, admin panel at `src/app/(payload)`, collections directory
- Like t3-app, it is a one-shot generator, not a dev-environment tool

**Verdict for Loop:** A `npx create-loop-app` scaffolder could eventually be valuable for SDK/integration setup, but it is not the right tool for contributor onboarding. Skip this entirely in the near term.

---

### 2. Docker Compose for Local Dev: The Highest-Leverage Pattern

This is the single most impactful pattern across every project examined.

**Documenso's `npm run dx` (best small-project example):**

```
cp .env.example .env   # .env.example has working defaults pre-filled
npm run dx             # docker compose up for: postgres:54320, inbucket mail:9000, S3:9001
npm run dev            # start the app
```

Three steps. The `.env.example` already has valid values for local dev — contributors do not need to fill anything in to get started. The `dx` script name is an alias for `docker compose up -d`.

**Cal.com's `yarn dx`:**

```
cp .env.example .env
openssl rand -base64 32  # manual secret generation step
yarn workspace @calcom/prisma db-deploy
yarn dx                  # starts local postgres + test users, logs credentials to console
```

Cal.com uses the same `dx` convention but still requires a manual secret generation step. Their docker setup seeds test users and logs the credentials automatically.

**Supabase's self-hosting pattern:**

- Clone repo, `cd docker`, `cp .env.example .env`
- Requires manual JWT secret generation (at least 32 chars) plus deriving ANON_KEY and SERVICE_KEY
- Complex because it orchestrates 8+ services (Postgres, GoTrue, PostgREST, Realtime, Storage, Studio, Kong, Logflare)
- The complexity here is inherent to Supabase's scope — not a model for small projects

**Formbricks' docker-compose.dev.yml:**

- Single command starts: PostgreSQL, Valkey (Redis), MinIO, Mailhog
- Redirects to signup on first visit — no credentials needed
- The dev compose file is distinct from the production compose file

**Pros for a small monorepo (Loop's scale):**

- One command replaces "install postgres, create a database, configure pg_hba.conf"
- Compose file is checked in, so the environment is reproducible
- Works on macOS, Linux, and Windows (WSL2)
- Can pre-seed schema and sample data in the container's init scripts

**Cons:**

- Requires Docker Desktop (licensing cost for large companies, but fine for open source contributors)
- Slightly slower first start than native postgres
- Adds a file to maintain

**Recommendation for Loop:** A `docker-compose.dev.yml` that starts a Postgres container (with a named volume for persistence) is the single highest-ROI change. Pair it with an `npm run dx` alias in the root `package.json`.

---

### 3. Env Validation with Helpful Error Messages

**The standard pattern: Zod at module load time**

```typescript
// apps/api/src/env.ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  LOOP_API_KEY: z.string().min(1, 'LOOP_API_KEY is required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

// Throws immediately on startup if any variable is invalid
export const env = schema.parse(process.env);
```

When `schema.parse(process.env)` throws, Zod produces output like:

```
ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["DATABASE_URL"],
    "message": "Required"
  }
]
```

**The t3-env upgrade for better DX:**

`@t3-oss/env-core` adds two critical behaviors:

1. `onValidationError` callback — intercept the raw ZodError and print something human-readable before throwing
2. `onInvalidAccess` callback — catches server env accessed on the client with a named variable in the message

```typescript
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    LOOP_API_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  onValidationError: (issues) => {
    console.error('\n  Invalid environment variables:\n');
    issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    console.error('\n  Check .env against .env.example\n');
    process.exit(1);
  },
});
```

**What good error output looks like:**

```
  Invalid environment variables:

  - DATABASE_URL: Required
  - LOOP_API_KEY: String must contain at least 1 character(s)

  Check .env against .env.example
```

**Key practices seen across projects:**

- `emptyStringAsUndefined: true` so `VARIABLE=` (empty) is treated as missing, not as an empty string that passes `z.string()`
- Validate at import time (module load), not inside request handlers
- Keep `.env.example` always up to date — it is the canonical list of required variables
- Pre-fill `.env.example` with safe, working local defaults (not just `YOUR_SECRET_HERE`)

---

### 4. Setup Scripts

**The conventional pattern (Rails-derived, widely adopted):**

`scripts/setup.sh` or `bin/setup`:

1. Check node/npm version against `.node-version` or `package.json#engines`
2. Copy `.env.example` to `.env` if `.env` does not exist
3. Generate secrets (`openssl rand -base64 32`) and patch them into `.env`
4. Check database connectivity
5. Run migrations
6. Optionally seed sample data

**Cal.com example (manual, documented in docs):**

```bash
cp .env.example .env
openssl rand -base64 32  # -> paste as NEXTAUTH_SECRET
yarn workspace @calcom/prisma db-deploy
yarn dx  # starts docker db
```

Cal.com does not have an automated setup script — the steps are in their docs. This is the modal approach for most projects: steps are documented, not scripted.

**What an ideal setup script looks like for a Node/Postgres project:**

```bash
#!/usr/bin/env bash
set -e

# 1. Check prerequisites
REQUIRED_NODE="20"
CURRENT_NODE=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$CURRENT_NODE" -lt "$REQUIRED_NODE" ]; then
  echo "Error: Node.js v$REQUIRED_NODE+ required (found $(node --version))"
  exit 1
fi

# 2. Copy env if not present
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  echo "Created apps/api/.env from .env.example"

  # 3. Generate secrets
  SECRET=$(openssl rand -base64 32)
  sed -i.bak "s/LOOP_API_KEY=changeme/LOOP_API_KEY=$SECRET/" apps/api/.env
  rm apps/api/.env.bak
  echo "Generated LOOP_API_KEY in .env"
else
  echo "apps/api/.env already exists, skipping"
fi

# 4. Install dependencies
npm install

# 5. Start backing services
npm run dx
sleep 3

# 6. Run migrations
cd apps/api && npm run db:migrate

echo ""
echo "Setup complete. Run 'npm run dev' to start."
```

**Observations:**

- Most projects skip this script and rely on documented steps — that is acceptable if the steps are minimal
- The highest-value parts are step 2 (copy env) and step 3 (generate secrets automatically)
- Secret generation via `openssl rand -base64 32` is the universal pattern across projects
- A Node.js script is more cross-platform than bash (no Windows bash requirement)

---

### 5. Dev Containers / GitHub Codespaces

**How they work:**

- `.devcontainer/devcontainer.json` defines the container image, VS Code extensions, and `postCreateCommand`
- `postCreateCommand` runs after the container is built — typically installs deps and starts services
- Port forwarding is declared in the config — VS Code prompts to open in browser
- Extensions are standardized across all contributors (ESLint, Prettier, etc.)

**Example configuration:**

```json
{
  "name": "Loop",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "forwardPorts": [4242, 3000, 5432],
  "postCreateCommand": "npm install && cp -n apps/api/.env.example apps/api/.env && npm run dx && sleep 5 && cd apps/api && npm run db:migrate",
  "customizations": {
    "vscode": {
      "extensions": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint", "ms-playwright.playwright"]
    }
  }
}
```

**The key principle:** "Things like linters are good to standardize on and require everyone to have installed. Things like UI decorators or themes are personal choices that should not be in devcontainer.json."

**Value proposition:**

- A new contributor opens the repo in Codespaces and has a running environment in 3-5 minutes with zero local installs
- The postCreateCommand runs your setup script automatically
- Eliminates "works on my machine" entirely
- Free for public repos (GitHub provides Codespaces minutes free for open source)

**Cost/complexity:**

- `devcontainer.json` is roughly 20-30 lines
- Maintains itself if your `postCreateCommand` calls `npm install`
- The main work is ensuring `.env.example` has working local defaults — which you need anyway

---

### 6. Documentation-Driven Setup

**What good setup docs look like:**

Cal.com's local development docs are the best example examined. They:

- List exact prerequisites with versions (`Node.js 18.x or higher`)
- Provide copy-pasteable commands in code blocks
- Have a "Quick Start" section (`yarn dx`) and a "Manual Setup" section
- Note platform-specific differences (Windows symlinks)
- Include verification steps so contributors can confirm setup succeeded

**Common anti-patterns:**

- CONTRIBUTING.md says "see README" with no further detail
- Prerequisites listed without version numbers
- Secret generation not mentioned or left as an exercise
- Database setup assumes postgres is already configured
- No verification step — no way to confirm setup succeeded

**The key principle from every good setup doc:** Provide a "Quick Start" path (3-4 commands, requires Docker) and a "Manual Setup" path (more steps, no Docker required). Let contributors self-select.

---

## Ranked Recommendations for Loop

Ranked by **impact-to-effort ratio** for a 3-app Turborepo with PostgreSQL.

---

### Rank 1: Pre-filled `.env.example` with working local defaults

**Effort: 30 minutes | Impact: Very High**

The single highest-leverage change. Every project that does this well (Documenso being the best example) lets contributors run `cp .env.example .env` and proceed immediately without filling anything in for local dev.

**For Loop's `apps/api/.env.example`:**

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/loop_dev` (matches the docker compose container)
- `LOOP_API_KEY=dev-api-key-change-in-production` (a static string that works for local testing)
- `NODE_ENV=development`
- Add a comment above each variable explaining what it is and where to get the real value for production
- Webhook secrets can be left empty with a comment noting they are only required in production

This change costs 30 minutes and eliminates one of the most common new-contributor failure modes.

---

### Rank 2: `docker-compose.dev.yml` + `npm run dx`

**Effort: 2-3 hours | Impact: Very High**

Eliminates the "install and configure PostgreSQL" prerequisite entirely.

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: loop_dev
    ports:
      - '5432:5432'
    volumes:
      - loop_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  loop_postgres_data:
```

In root `package.json`:

```json
"scripts": {
  "dx": "docker compose -f docker-compose.dev.yml up -d",
  "dx:down": "docker compose -f docker-compose.dev.yml down"
}
```

Combined getting-started flow:

```
git clone https://github.com/dork-labs/loop
cd loop
npm install
cp apps/api/.env.example apps/api/.env
npm run dx
cd apps/api && npm run db:migrate
npm run dev
```

Six steps. No postgres installation. No database creation. No `pg_hba.conf`.

---

### Rank 3: Zod env validation with actionable error messages

**Effort: 1-2 hours | Impact: High**

The API should fail at startup — not at first request — when env vars are missing, with a message naming the missing variable. This uses Zod which Loop already depends on.

Extract env validation to `apps/api/src/env.ts`:

```typescript
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z
    .string({
      required_error: 'DATABASE_URL is required — set it in apps/api/.env',
    })
    .url('DATABASE_URL must be a valid PostgreSQL connection string'),
  LOOP_API_KEY: z
    .string({
      required_error: 'LOOP_API_KEY is required — set it in apps/api/.env',
    })
    .min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  POSTHOG_WEBHOOK_SECRET: z.string().optional(),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error('\nMissing or invalid environment variables:');
  result.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  console.error('\nCopy apps/api/.env.example to apps/api/.env\n');
  process.exit(1);
}

export const env = result.data;
```

This is ~25 lines, no new dependencies, and eliminates the "why is the app crashing" class of new-contributor confusion.

---

### Rank 4: `scripts/setup.sh`

**Effort: 2-3 hours | Impact: Medium**

A setup script is valuable but optional if ranks 1-3 are in place. If added, keep it simple. The highest-value elements are: checking node version, copying env only if not present, running `npm install`, starting docker services, and running migrations.

Consider a Node.js script (`.mjs`) instead of bash for cross-platform compatibility — Windows contributors with Git Bash or PowerShell may have issues with bash scripts using `sed` and `openssl`.

---

### Rank 5: `.devcontainer/devcontainer.json`

**Effort: 1 hour | Impact: Medium for open source**

Adds a zero-local-setup path for contributors using GitHub Codespaces or VS Code Dev Containers. Low effort because it composes on top of ranks 1-4 — it just calls `npm run dx` and `npm run db:migrate` in `postCreateCommand`.

Add this after ranks 1-3 are solid. The devcontainer is not a standalone solution; it calls the same setup infrastructure.

---

### What to Skip (for now)

- **Interactive CLI wizard** (`npx create-loop-app`) — only valuable for end-user SDK setup, not contributor DX. Significant complexity for minimal benefit at Loop's current stage.
- **Full Docker Compose for all three apps** (Supabase-style all-in-compose) — only the database needs to be containerized for local dev. Running the Node apps natively is faster for development.
- **Automated secret rotation in setup script** — just document `openssl rand -base64 32` in comments in `.env.example`. Let developers generate their own secrets.
- **Kubernetes or Bazel** — appropriate for Unkey's scale and team size, not for Loop.

---

## Detailed Analysis

### The "dx" Convention

The `yarn dx` / `npm run dx` convention (seen in Cal.com, Documenso, and others) appears to be an emerging standard. "dx" stands for "developer experience" and signals "this command sets up your local environment." It is distinct from `dev` (which starts the app). The pattern is:

- `npm run dx` — start backing services via docker compose
- `npm run dx:down` — stop them
- `npm run dev` — start the application

This separation is cleaner than embedding docker compose in the `dev` script because developers often want to stop and restart the app without tearing down the database. The named volume ensures data persists across `dx:down` / `dx` cycles.

### The `.env.example` as Canonical Documentation

The single most under-appreciated pattern: `.env.example` is not just a template, it is documentation. Every project that does setup well treats it as:

1. A complete list of every variable the app needs
2. Pre-filled with safe local defaults wherever possible
3. Annotated with comments explaining each variable, whether it is required, and where to get the value
4. The thing you point new contributors to in the README

The anti-pattern is `.env.example` with only variable names and no values or comments, leaving contributors to discover what values are needed through trial and error.

### Migration Timing in Setup

The right place to run migrations is after the database is up but before `npm run dev`. Projects handle this differently:

- Cal.com: `yarn workspace @calcom/prisma db-deploy` (explicit documented step)
- Documenso: `npm run prisma:migrate-dev` (explicit documented step)

Running migrations in `postCreateCommand` (devcontainer) requires a `sleep` or health-check loop to wait for postgres to accept connections. The `healthcheck` in `docker-compose.dev.yml` enables `depends_on: condition: service_healthy` patterns.

### Why Not a Full CLI Wizard for Contributor Onboarding

The create-t3-app pattern (interactive prompts, template generation) is designed for a one-time project scaffolding experience. For contributor onboarding to an existing project, the interaction model is different: the project structure is already decided, and contributors just need their environment to match it. The right tool for that is a short, well-commented setup sequence (ideally 4-6 commands), not an interactive wizard.

---

## Research Gaps & Limitations

- Could not access Formbricks' specific development setup documentation (page redirected to index)
- Unkey's setup is heavily Bazel/Go-oriented — not directly applicable to a TypeScript monorepo
- Did not find examples of open source projects that automatically generate secrets in a setup script (most document the `openssl` command and let developers run it manually — or they pre-fill a development-only static secret in `.env.example`)
- Cal.com's CONTRIBUTING.md was sparse; full setup docs were in the separate docs site

---

## Contradictions & Disputes

- **Docker vs native postgres**: Some projects (Cal.com) offer both `yarn dx` (docker) and a manual postgres path. Others (Formbricks) only document docker compose for local dev. For Loop, offering both is correct: docker compose for the fast path, native postgres for contributors who prefer it.
- **Bash vs Node scripts**: Bash setup scripts are conventional but do not work well on Windows without WSL2. A Node.js `.mjs` setup script is more portable. No clear cross-project consensus — choose based on your expected contributor OS distribution.
- **Secret generation**: Some projects auto-generate secrets in setup scripts; most document the `openssl` command and have contributors run it manually. Pre-filling `.env.example` with a static development-only value (clearly labeled as dev-only) is arguably better UX than requiring any secret generation step at all.

---

## Sources & Evidence

- [Create T3 App — CLI Usage and Options (DeepWiki)](https://deepwiki.com/t3-oss/create-t3-app/2.2-cli-usage-and-options)
- [create-t3-app GitHub](https://github.com/t3-oss/create-t3-app)
- [Supabase — Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase — Local Development](https://supabase.com/docs/guides/local-development)
- [Cal.com — Local Development Docs](https://cal.com/docs/developing/local-development)
- [Cal.com — Contributor's Guide](https://cal.com/docs/developing/open-source-contribution/contributors-guide)
- [Cal.com Docker](https://github.com/calcom/docker)
- [Documenso — Developer Quickstart](https://docs.documenso.com/developers/local-development/quickstart)
- [Documenso — Manual Setup](https://docs.documenso.com/developers/local-development/manual)
- [Documenso GitHub](https://github.com/documenso/documenso)
- [Formbricks — Docker Setup](https://formbricks.com/docs/self-hosting/setup/docker)
- [Formbricks — docker-compose.dev.yml](https://github.com/formbricks/formbricks/blob/main/docker-compose.dev.yml)
- [T3 Env — Customization](https://env.t3.gg/docs/customization)
- [T3 Env — Core](https://env.t3.gg/docs/core)
- [Env validation with Zod (creatures.sh)](https://www.creatures.sh/blog/env-type-safety-and-validation/)
- [Validating environment variables with Zod (Francisco Sousa)](https://jfranciscosousa.com/blog/validating-environment-variables-with-zod)
- [GitHub Codespaces devcontainer guide](https://docs.github.com/codespaces/setting-up-your-project-for-codespaces/introduction-to-dev-containers)
- [GitHub — Optimize local dev environments for onboarding](https://github.com/readme/guides/developer-onboarding)
- [Payload CMS — Installation](https://payloadcms.com/docs/getting-started/installation)
- [Appwrite — Self-Hosting](https://appwrite.io/docs/advanced/self-hosting)
- [Plane — Docker Compose self-hosting](https://developers.plane.so/self-hosting/methods/docker-compose)

---

## Search Methodology

- Searches performed: 16
- Most productive search terms: "npm run dx", "docker-compose.dev.yml", "cp .env.example", "@t3-oss/env-core onValidationError", "devcontainer postCreateCommand"
- Most valuable single source: Documenso quickstart docs — clearest example of the full fast-path setup pattern for a small project
- Primary source types: Official project documentation, GitHub repositories, npm package pages, project docs sites
