import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Walks up from this file to the folder containing pnpm-workspace.yaml. */
export function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
}

/** apps/api/data/db.json, resolved from the repo root. */
export function defaultDbPath(): string {
  if (process.env.DATABASE_PATH) return resolve(process.env.DATABASE_PATH);
  return join(findRepoRoot(), 'apps', 'api', 'data', 'db.json');
}
