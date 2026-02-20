#!/bin/bash
# check-docs-changed.sh
# Stop hook — advisory reminder about docs that may need updating.
# NEVER blocks (always exits 0). Just prints a notice for Claude to relay.

set -e

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"

# Get uncommitted + staged changes
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || echo "")
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")
ALL_CHANGED=$(printf '%s\n%s' "$CHANGED_FILES" "$STAGED_FILES" | grep -v '^$' | sort -u)

# Nothing changed — nothing to check
if [ -z "$ALL_CHANGED" ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Pattern mappings: "doc-file:pattern1|pattern2|..."
#
# Rules for good patterns:
#   - Must be specific enough to avoid false positives (no bare "package.json")
#   - The doc file must actually exist in the repo
#   - Patterns match against the *full relative path* of changed files
#
# Only add mappings when a contributing guide or docs page actually exists.
# ---------------------------------------------------------------------------

MAPPINGS=()

# Auto-discover: if contributing/ guides exist, map them based on INDEX.md
# (For now, contributing/ is mostly empty — mappings will grow with the repo)

# CLAUDE.md is the canonical project reference — flag if core structure changes
if [ -f "$PROJECT_ROOT/CLAUDE.md" ]; then
  MAPPINGS+=(
    "CLAUDE.md:apps/api/src/db/schema/|apps/api/src/routes/|apps/api/src/middleware/|turbo.json|vitest.workspace.ts"
  )
fi

# Decisions index should stay in sync when ADRs are added/removed
if [ -f "$PROJECT_ROOT/decisions/manifest.json" ]; then
  MAPPINGS+=(
    "decisions/manifest.json:decisions/00"
  )
fi

# Specs manifest should stay in sync when specs are added/removed
if [ -f "$PROJECT_ROOT/specs/manifest.json" ]; then
  MAPPINGS+=(
    "specs/manifest.json:specs/[a-z]"
  )
fi

# If no mappings configured, nothing to check
if [ ${#MAPPINGS[@]} -eq 0 ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Match changed files against patterns
# ---------------------------------------------------------------------------
declare -a AFFECTED_DOCS

while IFS= read -r file; do
  [ -z "$file" ] && continue

  for mapping in "${MAPPINGS[@]}"; do
    doc="${mapping%%:*}"
    patterns="${mapping#*:}"

    # Skip if the doc file itself is the one that changed (it's already being updated)
    if [ "$file" = "$doc" ]; then
      continue
    fi

    for pattern in $(echo "$patterns" | tr '|' ' '); do
      if echo "$file" | grep -qE "$pattern"; then
        if [[ ! " ${AFFECTED_DOCS[*]} " =~ " ${doc} " ]]; then
          AFFECTED_DOCS+=("$doc")
        fi
        break
      fi
    done
  done
done <<< "$ALL_CHANGED"

# ---------------------------------------------------------------------------
# Output advisory notice (exit 0 — never blocks)
# ---------------------------------------------------------------------------
if [ ${#AFFECTED_DOCS[@]} -gt 0 ]; then
  echo "[docs-drift] These files may need updating based on your changes:"
  for doc in "${AFFECTED_DOCS[@]}"; do
    echo "  - $doc"
  done
  echo ""
  echo "Consider reviewing them before ending the session."
fi

exit 0
