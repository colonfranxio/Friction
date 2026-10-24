// OWNER: Agent D (Extension). Cross-platform build: bundles each entry and copies static files into dist/.
import { build, context } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const watch = process.argv.includes('--watch');

if (!watch) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const entries = ['content', 'background', 'popup'];
const missing = entries.filter((e) => !existsSync(join(here, 'src', `${e}.ts`)));
if (missing.length) throw new Error(`missing entries: ${missing.join(', ')}`);

const copyStatic = () => {
  for (const f of ['manifest.json', 'popup.html']) copyFileSync(join(here, f), join(dist, f));
};

const opts = {
  entryPoints: entries.map((e) => join(here, 'src', `${e}.ts`)),
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  logLevel: 'info',
  legalComments: 'none',
  plugins: [{ name: 'copy-static', setup(b) { b.onEnd(copyStatic); } }],
};

if (watch) await (await context(opts)).watch();
else await build(opts);
