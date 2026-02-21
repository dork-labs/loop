#!/usr/bin/env bash
set -euo pipefail

# Loop Development Setup
# Idempotent — safe to re-run at any time.

echo "Setting up Loop development environment..."
echo ""

# ─── Prerequisites ───────────────────────────────────────────────────────────

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed. Install Node.js 20+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20+ required (found $(node -v))"
  exit 1
fi
echo "  Node.js $(node -v)"

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "Error: Docker is not installed. Install Docker from https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "Error: Docker daemon is not running. Start Docker Desktop and try again."
  exit 1
fi
echo "  Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# ─── Dependencies ────────────────────────────────────────────────────────────

echo ""
echo "Installing dependencies..."
npm install

# ─── Environment Files ───────────────────────────────────────────────────────

echo ""
echo "Setting up environment files..."

copy_env() {
  local src="$1"
  local dest="$2"
  if [ -f "$dest" ]; then
    echo "  $dest already exists, skipping"
  else
    cp "$src" "$dest"
    echo "  Created $dest"
  fi
}

copy_env apps/api/.env.example apps/api/.env
copy_env apps/app/.env.example apps/app/.env
# Web env is optional — all vars are commented out
if [ ! -f apps/web/.env ]; then
  cp apps/web/.env.example apps/web/.env
  echo "  Created apps/web/.env"
else
  echo "  apps/web/.env already exists, skipping"
fi

# ─── Database ────────────────────────────────────────────────────────────────

echo ""
echo "Starting local PostgreSQL..."
npm run dx

# Wait for postgres to be healthy
echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U loop -d loop &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "Error: PostgreSQL did not become ready in time"
    exit 1
  fi
  sleep 1
done
echo "  PostgreSQL ready on localhost:54320"

# ─── Migrations ──────────────────────────────────────────────────────────────

echo ""
echo "Running database migrations..."
npm run db:migrate -w apps/api

# ─── Done ────────────────────────────────────────────────────────────────────

echo ""
echo "Setup complete! Run 'npm run dev' to start all apps."
echo ""
echo "  API:       http://localhost:4242"
echo "  Dashboard: http://localhost:3000"
echo "  Docs:      http://localhost:3001"
