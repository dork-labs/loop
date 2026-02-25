---
description: Sync tasks from 03-tasks.json (or 03-tasks.md fallback) to the built-in task system
category: validation
allowed-tools: Read, TaskCreate, TaskList, TaskGet, TaskUpdate, Grep, Write, Bash(echo:*), Bash(basename:*)
argument-hint: '<path-to-tasks-file (.json or .md)>'
---

# Sync Tasks to Task System

Parse task files and create any missing tasks in the built-in task system.

**Primary source**: `specs/[slug]/03-tasks.json` (structured, trivial to parse)
**Fallback source**: `specs/[slug]/03-tasks.md` (regex parsing for backward compatibility)

**Use this command when:**

- `/spec:decompose` completed but tasks weren't created (e.g., session ended before Phase 4)
- `03-tasks.json` exists but `TaskList()` shows no matching tasks
- You need to manually sync tasks after editing task files
- You want to generate a companion file (JSON from MD, or MD from JSON)

## Arguments

- `$ARGUMENTS` - Path to the tasks file. Accepts either:
  - `specs/<slug>/03-tasks.json` (preferred)
  - `specs/<slug>/03-tasks.md` (fallback)
  - `specs/<slug>` (auto-detects: tries JSON first, falls back to MD)

## Process

### Step 1: Resolve File Path and Extract Slug

```bash
INPUT="$ARGUMENTS"
```

Determine the source file:

1. If `INPUT` ends with `.json` → use as JSON source
2. If `INPUT` ends with `.md` → use as markdown source
3. If `INPUT` is a directory path (no extension) → check for `03-tasks.json` first, fall back to `03-tasks.md`

```bash
SLUG=$(echo "$INPUT" | cut -d'/' -f2)
```

Display:

```
Syncing tasks for: [slug]
   Source: [resolved file path]
   Format: [JSON/Markdown]
```

### Step 2: Get Existing Tasks

Check what tasks already exist in the task system:

```
all_tasks = TaskList()
existing_tasks = all_tasks.filter(t => t.subject.includes("[<slug>]"))
existing_subjects = existing_tasks.map(t => t.subject)
```

Display:

```
Found [count] existing tasks for [slug]
```

### Step 3: Parse Tasks

#### 3A: JSON Parsing (Primary)

If source is `03-tasks.json`:

```
Read specs/[slug]/03-tasks.json
Parse JSON
tasks = json.tasks
```

For each task, extract fields directly:
- `subject` from `task.subject`
- `description` from `task.description`
- `activeForm` from `task.activeForm`
- `dependencies` from `task.dependencies`
- `id` from `task.id` (for dependency resolution)

#### 3B: Markdown Parsing (Fallback)

If source is `03-tasks.md`:

Read the tasks file and extract task definitions.

**Task Header Pattern**: `### Task X.Y: [Title]`

For each task section, extract:

- **Phase number**: From `X` in `Task X.Y`
- **Task number**: From `Y` in `Task X.Y`
- **Title**: Text after the colon
- **Description**: Everything between this header and the next `### Task` or `## Phase` header
- **Dependencies**: From the `**Dependencies**:` line

**Parsing rules:**

Task Header Detection:
```regex
^### Task (\d+)\.(\d+): (.+)$
```
- Group 1: Phase number
- Group 2: Task number within phase
- Group 3: Task title

Description Extraction: Content between task header and next section marker (`### Task`, `## Phase`, `## `, or end of file).

Dependency Parsing:
```regex
\*\*Dependencies\*\*:\s*(.+)$
```
Parse comma-separated list: `Task 1.1, Task 1.2, Task 2.1`

ActiveForm Derivation: Convert imperative title to present continuous:
- "Create user schema" → "Creating user schema"
- "Implement login form" → "Implementing login form"
- "Add authentication" → "Adding authentication"
- "Set up database" → "Setting up database"

### Step 4: Identify Missing Tasks

For each parsed task:

1. Build expected subject (from JSON: use `task.subject` directly; from MD: `[<slug>] [P<phase>] <title>`)
2. Check if subject exists in `existing_subjects`
3. If not found, add to `missing_tasks` list

Display:

```
Task Analysis:
   Total in file: [count]
   Already synced: [count]
   Missing: [count]
```

### Step 5: Create Missing Tasks

For each missing task:

```
TaskCreate({
  subject: task.subject,
  description: task.description,
  activeForm: task.activeForm
})
```

Track the mapping of task IDs (e.g., "1.1") to system task IDs.

Display progress:

```
Creating tasks...
   [P1] Task title 1 → #taskId
   [P1] Task title 2 → #taskId
   [P2] Task title 3 → #taskId
   [P2] Task title 4 (error: <reason>)
```

**Retry logic**: If TaskCreate fails, retry once.

### Step 6: Set Up Dependencies

For each task with dependencies:

```
TaskUpdate({
  taskId: "<system-task-id>",
  addBlockedBy: [<resolved system task IDs>]
})
```

**Dependency Resolution (JSON)**: Look up JSON task ID → system task ID from the mapping built in Step 5.

**Dependency Resolution (Markdown)**:
- Parse `Task 1.1` references
- Convert to subjects for lookup: find task with matching `[P<phase>]` and title

Skip dependencies for tasks that don't exist in the system.

### Step 7: Offer Companion File Generation

If the source was JSON and `03-tasks.md` doesn't exist (or vice versa):

```
Would you like me to generate the companion file?
   Source: 03-tasks.json → Generate: 03-tasks.md (human-readable)
```

If user accepts, generate the companion file from the parsed data.

### Step 8: Report Results

```
SYNC COMPLETE

Results:
   Source: [JSON/Markdown]
   Tasks Created: [count]
   Dependencies Set: [count]
   Errors: [count]

[If errors:]
Some tasks could not be created:
   - [P2] Task title: <error reason>

Tasks are now synced. Run `/spec:execute` to begin implementation.
```

## Companion File Generation

### JSON → Markdown

When generating `03-tasks.md` from `03-tasks.json`:

1. Read the JSON file
2. Group tasks by phase
3. Write markdown following the standard format (see decompose.md Step 5 format)
4. Include all task details from JSON descriptions

### Markdown → JSON

When generating `03-tasks.json` from `03-tasks.md`:

1. Parse the markdown file using the regex patterns above
2. Build the JSON structure following the schema (see decompose.md Step 4 schema)
3. Derive fields that don't exist in markdown:
   - `size`: default to "medium"
   - `priority`: default to "medium"
   - `parallelWith`: infer from "Can run parallel with" line if present
4. Write the JSON file

## Error Handling

### File Not Found

```
Tasks file not found: $ARGUMENTS

Tried:
   - specs/[slug]/03-tasks.json (not found)
   - specs/[slug]/03-tasks.md (not found)

Make sure the path is correct or run /spec:decompose first.
```

### No Tasks Found in File

```
No tasks found in $ARGUMENTS

The file exists but no task definitions were detected.
Expected: JSON array in "tasks" field, or markdown with ### Task X.Y: headers
```

### All Tasks Already Synced

```
All tasks already synced

Found [count] tasks for [slug] in task system.
Nothing to create.
```

### Invalid JSON

```
Invalid JSON in $ARGUMENTS

The file exists but couldn't be parsed as valid JSON.
Check the file for syntax errors or run /spec:decompose again.
```

## Usage Examples

```bash
# Sync from JSON (preferred)
/spec:tasks-sync specs/user-authentication/03-tasks.json

# Sync from markdown (backward compatible)
/spec:tasks-sync specs/dashboard-redesign/03-tasks.md

# Auto-detect format
/spec:tasks-sync specs/api-rate-limiting

# After editing tasks.json manually
/spec:tasks-sync specs/user-authentication/03-tasks.json
```

## Integration

| Related Command   | Relationship                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| `/spec:decompose` | Creates 03-tasks.json + 03-tasks.md; this command syncs them to task system |
| `/spec:execute`   | Executes tasks created by decompose or this sync command                  |
| `TaskList()`      | View all synced tasks                                                     |
