import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'claude');
export const fixtureText = (name: string) => readFileSync(join(dir, name), 'utf8');
export const fixtureJson = <T = any>(name: string): T => JSON.parse(fixtureText(name));
