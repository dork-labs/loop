---
description: Break down a validated specification into actionable implementation tasks
category: validation
allowed-tools: Read, Task, TaskOutput, Write, Bash(mkdir:*), Bash(cat:*), Bash(grep:*), Bash(echo:*), Bash(basename:*), Bash(date:*), TaskCreate, TaskList, TaskGet, TaskUpdate
argument-hint: '<path-to-spec-file>'
---

# Decompose Specification into Tasks

Decompose the specification at: $ARGUMENTS

## Disk-First Architecture

This command uses a **background agent** for heavy analysis and a **main context** for task creation. Background agents cannot use TaskCreate/TaskUpdate/TaskList — only the main context can.

**Flow:**

1. Main context: Extract slug, detect mode, spawn background agent
2. Background agent: Read spec, analyze, write `03-tasks.json` + `03-tasks.md` to disk
3. Main context: Read `03-tasks.json`, create all tasks via TaskCreate, set up dependencies
4. Main context: Quality spot-check, report results

## Phase 1: Setup (Main Context)

### 1.1 Extract Feature Slug

Extract the feature slug from the spec path:

- If path is `specs/<slug>/02-specification.md` → slug is `<slug>`
- If path is `specs/feat-<slug>.md` (legacy) → slug is `feat-<slug>`
- If path is `specs/fix-<issue>-<desc>.md` (legacy) → slug is `fix-<issue>-<desc>`

```bash
SPEC_FILE="$ARGUMENTS"
SLUG=$(echo "$SPEC_FILE" | cut -d'/' -f2)
TASKS_JSON="specs/$SLUG/03-tasks.json"
TASKS_FILE="specs/$SLUG/03-tasks.md"
```

### 1.2 Quick Mode Detection

Perform lightweight checks to determine mode:

1. **Check for existing tasks:**
   Use `TaskList()` and filter for tasks with subject containing `[<slug>]`
   - If no matching tasks found → **Full mode**
   - Display: "First-time decompose - Full mode"

2. **Check if task files exist:**
   - If `specs/<slug>/03-tasks.json` doesn't exist → **Full mode**
   - Display: "Tasks file missing - Full mode"

3. **For incremental detection** (if tasks JSON exists):
   - Read the JSON file's `lastDecompose` field
   - If found, note the date for the background agent
   - Display mode indicator

If **Skip mode** detected (no changelog changes):

- Display: "No changes since last decompose (<date>)"
- Display: " To force re-decompose, delete <tasks-json>"
- **Exit early** - do not spawn background agent

## Phase 2: Spawn Background Agent

If proceeding with decomposition (Full or Incremental mode), spawn the background agent:

```
Task(
  description: "Decompose [slug] spec into tasks",
  prompt: <see BACKGROUND_AGENT_PROMPT below>,
  subagent_type: "general-purpose",
  run_in_background: true
)
```

Display to user:

```
Decomposition started in background
   Spec: $ARGUMENTS
   Mode: [Full/Incremental]
   Slug: [slug]

   You can continue working. Use one of these to check progress:
   - Wait for completion: I'll notify you when done
   - Check status: /tasks to see running tasks
   - Continue working: I'll let you know when the agent finishes
```

## Phase 3: Wait for Results

After spawning the background agent, ask the user:

```
The decomposition is running in the background. Would you like me to:
1. **Wait and report** - I'll wait for completion and show you the results
2. **Continue working** - You can do other tasks; I'll notify when done
```

If user chooses to wait, use:

```
TaskOutput(task_id: "<agent-task-id>", block: true)
```

Then proceed to Phase 4.

## Phase 4: Create Tasks from JSON (Main Context)

This is the PRIMARY task creation path. The background agent wrote structured data to disk; now the main context reads it and creates tasks.

### 4.1 Read and Parse JSON

```
Read specs/[slug]/03-tasks.json
Parse the JSON into a tasks array
```

If the JSON file doesn't exist or is malformed:

```
Task creation failed - JSON file not found or invalid.

The background agent may not have completed successfully.
Check specs/[slug]/ for partial output.

Options:
1. **Retry** - Run `/spec:decompose` again
2. **Manual sync** - If 03-tasks.md exists, run `/spec:tasks-sync specs/[slug]/03-tasks.md`
```

### 4.2 Quality Spot-Check

Before creating tasks, inspect 2-3 task descriptions from the JSON:

1. Pick task descriptions at random (first, middle, last)
2. Verify they contain full implementation details (code blocks, acceptance criteria)
3. Check for forbidden phrases: "as specified", "from spec", "see specification"

If descriptions are too thin:

```
Quality check failed - task descriptions are summaries, not full implementations.
Re-running decomposition with stricter instructions...
```

### 4.3 Create Tasks

For each task in the JSON `tasks` array:

```
TaskCreate({
  subject: task.subject,
  description: task.description,
  activeForm: task.activeForm
})
```

Track the mapping of JSON task IDs (e.g., "1.1") to system task IDs for dependency resolution.

Display progress:

```
Creating tasks...
   [P1] Task title 1 → #taskId
   [P1] Task title 2 → #taskId
   [P2] Task title 3 → #taskId
```

### 4.4 Set Up Dependencies

For each task that has `dependencies` in the JSON:

```
TaskUpdate({
  taskId: "<system-task-id>",
  addBlockedBy: [<resolved system task IDs from dependencies>]
})
```

Resolve dependencies by looking up the JSON ID → system ID mapping from step 4.3.

### 4.5 Handle Creation Failures

If some TaskCreate calls fail:

```
Task Creation Issue

Expected: [X] tasks | Created: [Y] tasks

Failed tasks:
   - [P2] Task title: <error reason>

Options:
1. **Retry failed** - Retry only the failed tasks
2. **Continue anyway** - Use `/spec:execute` with available tasks
3. **Re-run** - Delete JSON and run `/spec:decompose` again
```

### 4.6 Report Results

Display the final summary:

```
Decomposition Complete

Spec: [spec-path]
Mode: [Full/Incremental]
Tasks JSON: specs/[slug]/03-tasks.json
Tasks MD: specs/[slug]/03-tasks.md

Task Summary:
   Total: [count]
   Phase 1 (Foundation): [count] tasks
   Phase 2 (Core Features): [count] tasks
   Phase 3 (Testing): [count] tasks
   Phase 4 (Documentation): [count] tasks

Dependencies: [count] relationships set

Parallel Execution Opportunities:
   Tasks [X, Y, Z] can run in parallel
   Critical path: [list]

Next Steps:
   Run `/spec:execute specs/[slug]/02-specification.md` to begin implementation.
```

---

## BACKGROUND_AGENT_PROMPT

The following is the complete prompt sent to the background agent. It contains all the detailed decomposition instructions.

**IMPORTANT**: This agent writes files to DISK. It does NOT call TaskCreate, TaskUpdate, or TaskList — those tools are not available to background agents.

````
You are decomposing a specification into actionable implementation tasks.

## Context
- **Spec File**: [SPEC_PATH]
- **Feature Slug**: [SLUG]
- **Mode**: [Full/Incremental]
- **Tasks JSON**: specs/[SLUG]/03-tasks.json
- **Tasks MD**: specs/[SLUG]/03-tasks.md
- **Last Decompose Date**: [DATE or "N/A for full mode"]

## Your Job

Read the specification, break it into implementation tasks, and write TWO files to disk:

1. **`specs/[SLUG]/03-tasks.json`** — Structured task data (machine-readable)
2. **`specs/[SLUG]/03-tasks.md`** — Human-readable breakdown (for git diffs, browsing)

You do NOT create tasks in the task system. The main conversation will read your JSON and create tasks. Your job is analysis and file writing only.

## Content Preservation Requirements

**THIS IS THE MOST IMPORTANT PART**: Task descriptions must be SELF-CONTAINED with ALL implementation details. Do NOT summarize or reference the spec — include the ACTUAL CODE and details.

### Pre-Flight Checklist

Before writing any tasks, confirm your understanding:
- [ ] I will NOT write summaries like "Create X as specified in spec"
- [ ] I will COPY all code blocks from the spec into task descriptions
- [ ] I will INCLUDE complete implementations, not references
- [ ] Each task will be self-contained with ALL details
- [ ] I will write files to disk, NOT call TaskCreate

**If you find yourself typing phrases like "as specified", "from spec", or "see specification" - STOP and copy the actual content instead!**

## Instructions

### Step 1: Read and Validate Specification

- Read the spec file at [SPEC_PATH]
- Verify it's a valid specification (has expected sections)
- Extract implementation phases and technical details

### Step 2: Analyze Specification Components

- Identify major features and components
- Extract technical requirements
- Note dependencies between components
- Identify testing requirements
- Document success criteria

### Step 2.5: Incremental Mode Processing (if MODE=incremental)

When running in incremental mode:

**Read existing 03-tasks.json** to understand prior task structure.

**Extract New Changelog Entries:**
- Read the spec file's "## 18. Changelog" section
- Find entries with dates >= last decompose date
- Extract: Issue, Decision, Changes to Specification, Implementation Impact

**Categorize Existing Tasks:**
1. **Preserve Tasks (DONE):** All completed tasks - no changes
2. **Update Tasks (UPDATED):** In-progress/pending tasks affected by changelog
3. **Create Tasks (NEW):** New work identified in changelog

### Step 3: Create Task Breakdown

Break down the specification into concrete, actionable tasks.

Key principles:
- Each task should have a single, clear objective
- **PRESERVE ALL CONTENT**: Copy implementation details, code blocks, and examples verbatim
- Define clear acceptance criteria with specific test scenarios
- Include tests as part of each task
- Document dependencies between tasks
- Create foundation tasks first, then build features on top
- Each task should be self-contained with all necessary details

**CRITICAL REQUIREMENT**: Preserve:
- Complete code examples (full functions, not snippets)
- All technical requirements and specifications
- Detailed implementation steps
- Configuration examples
- Error handling requirements
- All acceptance criteria and test scenarios

Task structure:
- Foundation tasks: Core infrastructure (database, frameworks, testing setup)
- Feature tasks: Complete vertical slices including all layers
- Testing tasks: Unit, integration, and E2E tests
- Documentation tasks: API docs, user guides, code comments

### Step 4: Write 03-tasks.json

Write the structured task data to `specs/[SLUG]/03-tasks.json` using this exact schema:

```json
{
  "spec": "specs/[SLUG]/02-specification.md",
  "slug": "[SLUG]",
  "generatedAt": "ISO 8601 timestamp",
  "mode": "full|incremental",
  "lastDecompose": "ISO 8601 date or null",
  "tasks": [
    {
      "id": "1.1",
      "phase": 1,
      "phaseName": "Foundation",
      "subject": "[SLUG] [P1] Imperative task title",
      "description": "Full implementation details including code blocks, acceptance criteria, everything needed to implement. This must be SELF-CONTAINED.",
      "activeForm": "Present continuous form for spinner",
      "size": "small|medium|large",
      "priority": "high|medium|low",
      "dependencies": [],
      "parallelWith": ["1.2", "1.3"]
    }
  ]
}
```

**Field requirements:**

- `id`: Phase.Task format (e.g., "1.1", "2.3")
- `phase`: Integer phase number
- `phaseName`: Human-readable phase name
- `subject`: MUST follow format `[SLUG] [P<phase>] Imperative title`
- `description`: FULL implementation details — this is what the implementing agent reads. Include ALL code, ALL requirements, ALL acceptance criteria. NEVER summarize.
- `activeForm`: Present continuous (e.g., "Implementing user schema")
- `size`: Estimate — small (<30min), medium (30-60min), large (1-2h)
- `priority`: high (blocking), medium (important), low (nice-to-have)
- `dependencies`: Array of task IDs this task depends on (e.g., ["1.1", "1.2"])
- `parallelWith`: Array of task IDs that can run simultaneously with this task

### Step 5: Write 03-tasks.md

Write the human-readable breakdown to `specs/[SLUG]/03-tasks.md`:

```markdown
# Task Breakdown: [Specification Name]
Generated: [Date]
Source: [spec-file]
Last Decompose: [Today's Date]

## Re-decompose Metadata (if incremental mode)

### Decompose History
| Session | Date | Mode | Changelog Entries | New Tasks | Notes |
|---------|------|------|-------------------|-----------|-------|

### Current Session Details
- **Mode**: [Full/Incremental]
- **Previous Decompose**: [date]
- **Current Decompose**: [today]

## Overview
[Brief summary of what's being built]

## Phase 1: Foundation

### Task 1.1: [Task Title]
**Description**: One-line summary
**Size**: Small/Medium/Large
**Priority**: High/Medium/Low
**Dependencies**: None
**Can run parallel with**: Task 1.2, 1.3

**Technical Requirements**:
- [All technical details from spec]

**Implementation Steps**:
1. [Detailed step from spec]

**Acceptance Criteria**:
- [ ] [Specific criteria from spec]
- [ ] Tests written and passing

## Phase 2: Core Features
[Continue pattern...]
```

### Step 6: Return Summary

**IMPORTANT**: Return a structured summary for the main conversation:

```
## Decomposition Complete

**Spec**: [spec-path]
**Mode**: [Full/Incremental]
**Tasks JSON**: specs/[SLUG]/03-tasks.json
**Tasks MD**: specs/[SLUG]/03-tasks.md

### Task Summary
- **Total Tasks**: [count]
- **Phase 1 (Foundation)**: [count] tasks
- **Phase 2 (Core Features)**: [count] tasks
- **Phase 3 (Testing)**: [count] tasks
- **Phase 4 (Documentation)**: [count] tasks

### Parallel Execution Opportunities
- Tasks [X, Y, Z] can run in parallel
- Critical path: [list]

### Incremental Changes (if applicable)
- **Preserved**: [count] tasks (completed, no changes)
- **Updated**: [count] tasks (affected by changelog)
- **Created**: [count] tasks (new from changelog)
```
````

---

## Success Criteria

The decomposition is complete when:
- Background agent finished and wrote both `03-tasks.json` and `03-tasks.md`
- Main context read JSON and created all tasks via TaskCreate
- **Tasks preserve ALL implementation details including:**
  - Complete code blocks and examples (not summarized)
  - Full technical requirements and specifications
  - Detailed step-by-step implementation instructions
  - All configuration examples
  - Complete acceptance criteria with test scenarios
- Foundation tasks identified and prioritized
- Dependencies between tasks set up (TaskUpdate with addBlockedBy)
- All tasks include testing requirements
- Parallel execution opportunities identified
- **Tasks use proper structure:**
  - `subject`: `[<slug>] [P<phase>] Brief imperative title`
  - `description`: Complete technical implementation (ACTUAL CODE, not references)
  - `activeForm`: Present continuous form for spinner
- **Quality spot-check passed**: 2-3 task descriptions verified as self-contained
- **No summary phrases**: Tasks don't contain "as specified", "from spec", etc.

## Post-Completion Validation

After creating tasks from JSON:

1. **Sample Task Review**:
   - Use `TaskGet({ taskId })` on 2-3 tasks (first, middle, last)
   - Verify description contains full implementation details
   - Check for forbidden phrases: "as specified", "from spec", "see specification"

2. **Report to User**:
   - Display task creation summary
   - Highlight any issues found in validation
   - Provide next steps

## Integration with Other Commands

- **Prerequisites**: Run `/spec:validate` first to ensure spec quality
- **Next step**: Use `/spec:execute` to implement the decomposed tasks
- **Progress tracking**:
  - Use `TaskList()` to see all tasks with status
  - Filter by subject prefix: tasks containing `[slug]` belong to this feature
- **Manual sync**: Use `/spec:tasks-sync` to re-sync from JSON if tasks get lost

## Usage Examples

```bash
# Decompose a feature specification
/spec:decompose specs/feat-user-authentication/02-specification.md

# Decompose a system enhancement spec
/spec:decompose specs/feat-api-rate-limiting/02-specification.md
```

## Incremental Mode

### Overview

Incremental mode allows re-decomposition after feedback without recreating all tasks:

1. **Preserves completed work** - Tasks marked DONE are not regenerated
2. **Updates affected tasks** - In-progress tasks get changelog context
3. **Creates new tasks** - Only for work not covered by existing tasks
4. **Maintains numbering** - New tasks continue the sequence
5. **Tracks history** - Metadata section shows all decompose sessions

### Force Full Re-decompose

```bash
# Delete the task files
rm specs/<slug>/03-tasks.json specs/<slug>/03-tasks.md

# Run decompose (will use full mode)
/spec:decompose specs/<slug>/02-specification.md
```

## Troubleshooting

### Background Agent Not Completing

If the background agent takes too long:

1. Use `/tasks` to check status
2. Use `TaskOutput(task_id, block: false)` to check progress
3. Large specs may take several minutes - this is normal

### JSON File Missing After Agent Completes

**Symptom**: Agent reported success but `03-tasks.json` doesn't exist

**Cause**: Agent may have hit context limits before writing files

**Solutions**:

1. Re-run `/spec:decompose`
2. If `03-tasks.md` exists, use `/spec:tasks-sync specs/[slug]/03-tasks.md` (falls back to markdown parsing)

### Tasks Not Created (JSON exists but TaskList is empty)

**Symptom**: `03-tasks.json` file was created but `TaskList()` returns no matching tasks

**Cause**: Phase 4 task creation didn't run (e.g., session ended before Phase 4)

**Solutions**:

1. Run `/spec:tasks-sync specs/[slug]/03-tasks.json` to create tasks from JSON
2. Re-run `/spec:decompose` (will detect existing JSON)

### Quality Check Failed

**Symptom**: Task descriptions are too thin or contain "as specified" references

**Solution**: Re-run `/spec:decompose` — the agent prompt emphasizes content preservation

### Context Benefits

Running decomposition in background saves ~90% context:

- **Without background**: All spec content, analysis, task creation in main context
- **With background**: Only slug extraction, JSON reading, and task creation in main context
