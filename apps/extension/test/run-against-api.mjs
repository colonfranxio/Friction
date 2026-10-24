// Runs the service-worker integration tests against a real API (cross-platform; no VAR=x prefixes).
//   pnpm --filter @friction/extension test:api                      # default http://127.0.0.1:8787
//   pnpm --filter @friction/extension test:api -- http://127.0.0.1:8788
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:8787';
const here = dirname(fileURLToPath(import.meta.url));
console.log(`[test:api] running background integration tests against ${url}`);
const r = spawnSync('npx', ['vitest', 'run', 'test/background.integration.test.ts'], {
  cwd: join(here, '..'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FRICTION_API_URL: url },
});
process.exit(r.status ?? 1);
