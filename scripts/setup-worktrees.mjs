#!/usr/bin/env node
// Cross-platform (Windows/macOS/Linux). Optional, for running several agents on ONE machine.
// Creates agent branches + sibling worktrees (../Friction-<agent>), copies .env, installs deps.
//
//   pnpm setup:worktrees                      # all four builders
//   pnpm setup:worktrees platform dashboard   # only some (e.g. the ones this machine runs)
//   pnpm setup:worktrees --dry-run            # print what would happen
//
// Agents on separate machines don't need this: clone, then `git checkout -b agent/<name>`.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ALL = ['platform', 'intelligence', 'dashboard', 'extension'];
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const picked = args.filter((a) => !a.startsWith('--'));
const agents = picked.length ? picked : ALL;
const bad = agents.filter((a) => !ALL.includes(a));
if (bad.length) {
  console.error(`Unknown agent(s): ${bad.join(', ')}. Choose from: ${ALL.join(', ')}`);
  process.exit(1);
}

const sh = (cmd, opts = {}) => {
  console.log(`$ ${cmd}${opts.cwd ? `   (in ${opts.cwd})` : ''}`);
  if (!dryRun) execSync(cmd, { stdio: 'inherit', shell: true, ...opts });
};
const quiet = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const root = quiet('git rev-parse --show-toplevel');
const parent = dirname(root);
const branchExists = (b) => {
  try {
    quiet(`git -C "${root}" rev-parse --verify --quiet refs/heads/${b}`);
    return true;
  } catch {
    return false;
  }
};

// pnpm may only be reachable through corepack (common on Windows without admin rights).
let pnpm = 'pnpm';
try {
  quiet('pnpm --version');
} catch {
  pnpm = 'corepack pnpm';
}

for (const agent of agents) {
  const dir = resolve(parent, `Friction-${agent}`);
  const branch = `agent/${agent}`;
  if (existsSync(dir)) {
    console.log(`= ${dir} already exists, skipping worktree creation`);
  } else {
    sh(`git -C "${root}" worktree add "${dir}" ${branchExists(branch) ? branch : `-b ${branch}`}`);
  }
  const envSrc = join(root, '.env');
  if (existsSync(envSrc)) {
    console.log(`$ copy .env → ${join(dir, '.env')}`);
    if (!dryRun) copyFileSync(envSrc, join(dir, '.env'));
  } else {
    console.log('! no .env at repo root yet: copy .env.example to .env and fill in ANTHROPIC_API_KEY');
  }
  sh(`${pnpm} install --frozen-lockfile`, { cwd: dir });
  console.log(`✓ ready: ${dir} (branch ${branch})\n`);
}
if (!dryRun) sh(`git -C "${root}" worktree list`);
