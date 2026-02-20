#!/usr/bin/env bash
# Runs TypeScript type checking on changed .ts/.tsx files
# Detects which app/package the file is in for the Turborepo monorepo

# Read JSON from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.tool_input?.file_path || '')")

# Skip if not a TypeScript file
if [[ ! "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

echo "📘 Type-checking $FILE_PATH" >&2

# Detect which workspace the file belongs to and run tsc from there
# Match on path segment anywhere in the string (handles both relative and absolute paths)
if [[ "$FILE_PATH" =~ /apps/api/ || "$FILE_PATH" =~ ^apps/api/ ]]; then
  WORKSPACE_DIR="apps/api"
elif [[ "$FILE_PATH" =~ /apps/server/ || "$FILE_PATH" =~ ^apps/server/ ]]; then
  WORKSPACE_DIR="apps/server"
elif [[ "$FILE_PATH" =~ /apps/client/ || "$FILE_PATH" =~ ^apps/client/ ]]; then
  WORKSPACE_DIR="apps/client"
elif [[ "$FILE_PATH" =~ /apps/obsidian-plugin/ || "$FILE_PATH" =~ ^apps/obsidian-plugin/ ]]; then
  WORKSPACE_DIR="apps/obsidian-plugin"
elif [[ "$FILE_PATH" =~ /apps/app/ || "$FILE_PATH" =~ ^apps/app/ ]]; then
  WORKSPACE_DIR="apps/app"
elif [[ "$FILE_PATH" =~ /apps/web/ || "$FILE_PATH" =~ ^apps/web/ ]]; then
  WORKSPACE_DIR="apps/web"
elif [[ "$FILE_PATH" =~ /apps/roadmap/ || "$FILE_PATH" =~ ^apps/roadmap/ ]]; then
  WORKSPACE_DIR="apps/roadmap"
elif [[ "$FILE_PATH" =~ /packages/shared/ || "$FILE_PATH" =~ ^packages/shared/ ]]; then
  WORKSPACE_DIR="packages/shared"
elif [[ "$FILE_PATH" =~ /packages/test-utils/ || "$FILE_PATH" =~ ^packages/test-utils/ ]]; then
  WORKSPACE_DIR="packages/test-utils"
else
  # Fallback: skip (no root-level tsconfig to check against)
  echo "⚠️  Could not detect workspace for $FILE_PATH, skipping typecheck" >&2
  exit 0
fi

# Run TypeScript compiler from the workspace directory (use absolute path for monorepo)
REPO_ROOT=$(git rev-parse --show-toplevel)
if ! npx tsc --noEmit --project "$REPO_ROOT/$WORKSPACE_DIR/tsconfig.json" 2>&1; then
  echo "❌ TypeScript compilation failed" >&2
  exit 2
fi

echo "✅ TypeScript check passed!" >&2
exit 0
