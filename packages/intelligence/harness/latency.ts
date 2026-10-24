// Measures evaluateExchange latency against real Claude: 10 sequential calls, p50/p95.
// Run: pnpm --filter @friction/intelligence latency   (needs ANTHROPIC_API_KEY + MODEL_GRADE in .env)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSeed, DEMO_PROMPTS, type BloomLevel } from '@friction/shared';
import { createIntelligence } from '../src/index';

const node = buildSeed().nodes.find((n) => n.concept_name === 'React useEffect')!;
const quiz = 'Quick check: in your own words, what does the dependency array tell React?';
const answers: [string, BloomLevel][] = [
  [DEMO_PROMPTS.correctAnswer, 1],
  [DEMO_PROMPTS.lazyAnswer, 3],
  ['It makes the effect run faster because React caches it.', 1],
  ['Something about when it re-runs?', 1],
  ['How do I center a div?', 1],
];

const intel = createIntelligence();
const rows: string[] = [];
const times: number[] = [];
for (let i = 0; i < 10; i++) {
  const [student_message, level] = answers[i % answers.length];
  const t = performance.now();
  const r = await intel.evaluateExchange({ node, level, quiz_text: quiz, student_message, demoMode: true });
  const ms = Math.round(performance.now() - t);
  times.push(ms);
  rows.push(`| ${i + 1} | ${ms} | ${r.verdict} | ${r.confidence.toFixed(2)} | "${student_message.slice(0, 40)}" |`);
  console.log(rows.at(-1));
}

const sorted = [...times].sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const summary = `p50 ${pct(50)}ms · p95 ${pct(95)}ms · max ${sorted.at(-1)}ms (model ${process.env.MODEL_GRADE}, effort low, n=10)`;
console.log(summary);

const dir = fileURLToPath(new URL('./results/', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(
  fileURLToPath(new URL('./results/latency.md', import.meta.url)),
  `# evaluateExchange latency\n\n${new Date().toISOString()}\n\n**${summary}**\n\n| # | ms | verdict | conf | answer |\n|---|---|---|---|---|\n${rows.join('\n')}\n`,
);
