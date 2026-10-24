#!/usr/bin/env bash
# Optional, for running all 4 agents on ONE machine.
# Creates agent branches + sibling worktrees (../Friction-<agent>) and copies .env into each.
# If teammates run agents on separate machines, skip this and just `git checkout -b agent/<name>`.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
for a in platform intelligence dashboard extension; do
  dir="../Friction-$a"
  if [ ! -d "$dir" ]; then
    git worktree add "$dir" -b "agent/$a" 2>/dev/null || git worktree add "$dir" "agent/$a"
  fi
  [ -f .env ] && cp .env "$dir/.env"
  (cd "$dir" && (pnpm install --frozen-lockfile || corepack pnpm install --frozen-lockfile))
  echo "ready: $dir (branch agent/$a)"
done
git worktree list
