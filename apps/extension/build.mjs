// OWNER: Agent D (Extension). Placeholder build: bundles each entry into dist/.
// Agent D extends this (copy manifest.json + popup.html into dist/, add entries).
import { build, context } from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';

const entries = ['main-world', 'content', 'background', 'popup'].filter((e) => existsSync(`src/${e}.ts`));
mkdirSync('dist', { recursive: true });
const opts = {
  entryPoints: entries.map((e) => `src/${e}.ts`),
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  logLevel: 'info',
};
if (process.argv.includes('--watch')) await (await context(opts)).watch();
else await build(opts);
