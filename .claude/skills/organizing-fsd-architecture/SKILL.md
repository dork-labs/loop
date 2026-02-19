---
name: organizing-fsd-architecture
description: Guides organization of code using Feature-Sliced Design (FSD) architecture. Use when structuring projects, creating new features, determining file and layer placement, or reviewing architectural decisions. Also monitors codebase size and proactively suggests structural improvements.
---

# Organizing FSD Architecture

## Overview

This skill provides expertise for implementing Feature-Sliced Design (FSD) in the Loop monorepo. FSD organizes code by business domains with clear layer boundaries and unidirectional dependency rules.

## When to Use

- Creating new features, widgets, or entities in `apps/app`
- Deciding where code should live (which layer/segment)
- Reviewing imports for layer violations
- Refactoring components into FSD structure

## Layer Hierarchy

FSD uses strict top-to-bottom dependency flow within `apps/app/src/layers/`:

```
app → widgets → features → entities → shared
```

| Layer       | Purpose                                               | Can Import From            |
| ----------- | ----------------------------------------------------- | -------------------------- |
| `app/`      | App initialization (`App.tsx`, `main.tsx`, providers) | All lower layers           |
| `widgets/`  | Large UI compositions (app layout, sidebars)          | features, entities, shared |
| `features/` | Complete user-facing functionality (chat, commands)   | entities, shared           |
| `entities/` | Business domain objects (Session, Command)            | shared only                |
| `shared/`   | Reusable utilities, UI primitives, Transport          | Nothing (base layer)       |

### Dependency Rules (Critical)

```
ALLOWED: Higher layer imports from lower layer
  features/chat/ui/ChatPanel.tsx → entities/session/model/types.ts
  widgets/app-layout/ui/Layout.tsx → features/chat/ui/ChatPanel.tsx

FORBIDDEN: Lower layer imports from higher layer
  entities/session/model/hooks.ts → features/chat/model/use-chat.ts
  shared/ui/Button.tsx → entities/session/ui/SessionBadge.tsx

FORBIDDEN: Same-level cross-imports (usually)
  features/chat/ → features/commands/
  entities/session/ → entities/command/
```

### Standard Segments

Each layer's modules follow this internal structure:

```
[layer]/[module-name]/
├── ui/          # React components
├── model/       # Business logic, hooks, stores, types
├── api/         # Transport calls, data fetching
├── lib/         # Pure utilities, helpers
├── config/      # Constants, configuration
└── index.ts     # Public API exports (barrel)
```

## Step-by-Step: Determine the Correct Layer

```
Is it a reusable utility, UI primitive (Button, Card), or type?
└─ YES → shared/

Is it a core business entity (Session, Command, StreamEvent)?
└─ YES → entities/[entity-name]/

Is it a complete user-facing feature (chat, command palette, settings)?
└─ YES → features/[feature-name]/

Is it a large composition of multiple features (app layout, main workspace)?
└─ YES → widgets/[widget-name]/

Is it app initialization, providers, or entry point?
└─ YES → app/ (App.tsx, main.tsx level)
```

## Layer Mapping

The Loop app (`apps/app/src/layers/`) uses FSD. Modules will be added as the app grows.

## Public API via index.ts (Required)

Every module MUST export its public API through `index.ts`:

```typescript
// features/chat/index.ts
export { ChatPanel } from './ui/ChatPanel';
export { useChatSession } from './model/use-chat-session';
export type { ChatMessage } from './model/types';

// DON'T export internal implementations
// export { parseStreamEvent } from './lib/stream-parser'  // Keep internal
```

Import from index, never from internal paths:

```typescript
// CORRECT: Import from module's public API
import { ChatPanel, useChatSession } from '@/layers/features/chat';

// WRONG: Import from internal path
import { ChatPanel } from '@/layers/features/chat/ui/ChatPanel';
```

## Cross-Feature Communication

**UI composition across features is allowed.** A feature's UI component may render a sibling feature's component (e.g., ChatPanel renders CommandPalette). **Model/hook cross-imports are forbidden** — this prevents circular business logic dependencies.

When features need to share data or logic:

```typescript
// Option 1: UI composition (ALLOWED)
// features/chat/ui/ChatPanel.tsx renders features/commands CommandPalette
import { CommandPalette } from '@/layers/features/commands';

// Option 2: Lift shared logic to entities layer
// entities/session/model/use-current-session.ts (shared across features)

// Option 3: Use Zustand store in shared layer for truly global UI state
// shared/model/app-store.ts (e.g., sidebar open/closed)

// FORBIDDEN: Model/hook importing from sibling feature
// features/chat/model/use-chat-session.ts → features/files/model/use-files.ts
```

## Detecting Layer Violations

```bash
# Find features importing from other features
grep -r "from '@/layers/features/" apps/app/src/layers/features/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"

# Find entities importing from features (should be 0)
grep -r "from '@/layers/features/" apps/app/src/layers/entities/ --include="*.ts"

# Find shared importing from anywhere except shared
grep -r "from '@/layers/" apps/app/src/layers/shared/ --include="*.ts" | grep -v "from '@/layers/shared"
```

## Common Pitfalls

- **Putting everything in shared/**: Only truly reusable, domain-agnostic code belongs in shared
- **Feature-to-feature imports**: Features must not import from each other; lift shared logic to entities
- **Giant features**: If a feature has 20+ files, split into multiple features or extract entities
- **Skipping index.ts**: Every module needs a public API barrel export
- **Shared layer bloat**: Only truly reusable, domain-agnostic code belongs in shared
