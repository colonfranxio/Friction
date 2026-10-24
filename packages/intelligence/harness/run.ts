// Live harness: runs the demo against real Claude and writes harness/results/latest.md.
// Usage: pnpm harness [levels] [grading] [classify] [parse] [exchange]   (no args = all)
import {
  buildSeed,
  DEMO_PROMPTS,
  FRICTION_OPEN,
  type BloomLevel,
  type ChatMessage,
  type Intelligence,
  type SkillNode,
} from '@friction/shared';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { keywordClassify } from '../src/classify';
import { createIntelligence } from '../src/index';
import { CLASSIFY_CASES, CP2_LEVELS, GRADING_CASES, LEVELS, QUIZ, SAMPLES_PER_LEVEL } from './cases';
import { textToPdf } from './pdf';

const intel: Intelligence = createIntelligence();
const nodes = buildSeed().nodes;
const node = nodes.find((n) => n.concept_name === 'React useEffect')!;
const want = process.argv.slice(2);
const runs = (s: string) => !want.length || want.includes(s);
const out: string[] = [`# Harness results`, '', `Run: ${new Date().toISOString()} · models: chat=${process.env.MODEL_CHAT} grade=${process.env.MODEL_GRADE} classify=${process.env.MODEL_CLASSIFY} parse=${process.env.MODEL_PARSE}`, ''];
const summary: string[] = [];
const ms = (t: number) => `${Math.round(performance.now() - t)}ms`;

async function reply(messages: ChatMessage[]) {
  const t = performance.now();
  let text = '';
  let ttft = '';
  for await (const d of intel.chat(messages)) {
    if (!ttft) ttft = ms(t);
    text += d;
  }
  return { text, ttft, total: ms(t) };
}

// ---- Level compliance -------------------------------------------------------
const FENCE = /```[\s\S]*?```/g;
const LEAK = /friction|instruction|tutor context|private note|⟦/i;
const lastLine = (s: string) => (s.trim().split('\n').filter((l) => l.trim()).at(-1) ?? '').replace(/[*_"')\s]+$/, '');
const BLANK = /_{3,}|\?\?\?|TODO|\/\*\s*\?/;

// L2 judge: a blank-free fence may just illustrate the bug, so ask a small model whether it is a ready-to-use fix.
const anthropic = new Anthropic();
const JudgeSchema = z.object({ gives_complete_fix: z.boolean(), reason: z.string() });
async function givesCompleteFix(text: string) {
  const res = await anthropic.messages.parse({
    model: process.env.MODEL_CLASSIFY!,
    max_tokens: 1024,
    output_config: { effort: 'low', format: zodOutputFormat(JudgeSchema) },
    messages: [
      {
        role: 'user',
        content: `A tutor was told to give only an outline with blanks, never a working solution. Does this reply contain complete, ready-to-paste code that fixes the student's problem? Code that only illustrates the bug, or has blanks left to fill, does not count.\n\n<reply>\n${text}\n</reply>`,
      },
    ],
  });
  return res.parsed_output!;
}

async function score(level: BloomLevel, text: string): Promise<string[]> {
  const fails: string[] = [];
  const fences = text.match(FENCE) ?? [];
  if (LEAK.test(text)) fails.push('mentions the hidden notes');
  if (level === 1) {
    if (fences.length) fails.push('has a code fence');
    if (!lastLine(text).endsWith('?')) fails.push('does not end with a question');
  }
  if (level === 2 && fences.some((f) => !BLANK.test(f))) {
    const j = await givesCompleteFix(text);
    if (j.gives_complete_fix) fails.push(`gives a complete fix (judge: ${j.reason})`);
  }
  if (level === 3) {
    if (!fences.length) fails.push('no code');
    if (!/\bbug\b/i.test(text)) fails.push('does not say there is a bug');
  }
  if (level === 4 && !fences.length) fails.push('no code fence');
  return fails;
}

const l1Replies: string[] = [];
if (runs('levels')) {
  out.push('## Level compliance (`DEMO_PROMPTS.question`)', '');
  for (const level of LEVELS) {
    const prompt = intel.buildFrictionPrompt({ raw_prompt: DEMO_PROMPTS.question, level, node, includeQuiz: level < 4 });
    const results = await Promise.all(
      Array.from({ length: SAMPLES_PER_LEVEL }, () => reply([{ role: 'user', content: prompt }]).then(async (r) => ({ ...r, fails: await score(level, r.text) }))),
    );
    const passed = results.filter((r) => !r.fails.length).length;
    const gate = CP2_LEVELS.includes(level) ? 'CP2' : 'CP3';
    summary.push(`- L${level}: **${passed}/${SAMPLES_PER_LEVEL}** (${gate} gate ≥4)`);
    out.push(`### L${level}: ${passed}/${SAMPLES_PER_LEVEL}`, '');
    results.forEach((r, i) => {
      out.push(`<details><summary>#${i + 1} ${r.fails.length ? `FAIL: ${r.fails.join('; ')}` : 'pass'} · first token ${r.ttft} · total ${r.total}</summary>`, '', r.text, '', '</details>', '');
    });
    if (level === 1) l1Replies.push(...results.map((r) => r.text));
  }
  // Demo risk: on stage the quiz is whatever Claude asked, so grade the demo answer against each real L1 reply.
  const grades = await Promise.all(
    l1Replies.map((quiz_text) => intel.evaluateExchange({ node, level: 1, quiz_text, student_message: DEMO_PROMPTS.correctAnswer, demoMode: true })),
  );
  const ok = grades.filter((g) => g.verdict === 'correct').length;
  summary.push(`- Demo answer vs the real L1 quizzes: **${ok}/${grades.length}** correct`);
  out.push('### Demo answer graded against each L1 reply above', '', ...grades.map((g, i) => `- #${i + 1}: ${g.verdict} ${g.confidence.toFixed(2)}: ${g.rationale}`), '');
}

// ---- Grading ----------------------------------------------------------------
if (runs('grading')) {
  out.push('## Grading', '', '| case | level | expected | got | confidence | new_level | time | rationale |', '|---|---|---|---|---|---|---|---|');
  const rows = await Promise.all(
    GRADING_CASES.map(async (c) => {
      const t = performance.now();
      const r = await intel.evaluateExchange({ node, level: c.level, quiz_text: QUIZ, student_message: c.message, demoMode: true });
      return { c, r, time: ms(t) };
    }),
  );
  let ok = 0;
  for (const { c, r, time } of rows) {
    const pass = ([] as string[]).concat(c.expect).includes(r.verdict);
    if (pass) ok++;
    out.push(`| ${c.name} | L${c.level} | ${([] as string[]).concat(c.expect).join(' / ')} | ${pass ? '' : '❌ '}${r.verdict} | ${r.confidence.toFixed(2)} | L${r.new_level} | ${time} | ${r.rationale} |`);
  }
  summary.push(`- Grading: **${ok}/${rows.length}** match`);
  out.push('');
}

// ---- Classify fallback ------------------------------------------------------
if (runs('classify')) {
  out.push('## Classify (LLM fallback)', '', '| prompt | expected | got | method | confidence | time |', '|---|---|---|---|---|---|');
  let ok = 0;
  for (const c of CLASSIFY_CASES) {
    const t = performance.now();
    const r = await intel.classifyTopic(c.prompt, nodes);
    const got = nodes.find((n) => n.id === r.node_id)?.concept_name ?? null;
    if (got === c.expect) ok++;
    out.push(`| ${c.prompt} | ${c.expect ?? 'null'} | ${got === c.expect ? '' : '❌ '}${got ?? 'null'} | ${r.method} | ${r.confidence.toFixed(2)} | ${ms(t)} |`);
  }
  summary.push(`- Classify fallback: **${ok}/${CLASSIFY_CASES.length}**`);
  out.push('');
}

// ---- Parse ------------------------------------------------------------------
if (runs('parse')) {
  out.push('## Parse (`fixtures/demo-syllabus.md`)', '');
  const md = readFileSync(fileURLToPath(new URL('../../../fixtures/demo-syllabus.md', import.meta.url)), 'utf8');
  const inputs = [
    { label: 'text', input: { kind: 'text' as const, text: md } },
    { label: 'pdf', input: { kind: 'pdf' as const, base64: textToPdf(md).toString('base64') } },
  ];
  for (const { label, input } of await Promise.all(inputs.map(async (x) => x))) {
    const t = performance.now();
    try {
      const tree = await intel.parseSyllabus(input);
      const time = ms(t);
      const ue = tree.nodes.find((n) => /useeffect/i.test(n.concept_name));
      const asNodes = tree.nodes.map((n) => ({ ...n, id: n.key })) as unknown as SkillNode[];
      const routed = keywordClassify(DEMO_PROMPTS.question, asNodes).node_id;
      const ok = tree.pillars.length >= 3 && tree.pillars.length <= 5 && tree.nodes.length >= 6 && tree.nodes.length <= 15 && !!ue && routed === ue.key;
      summary.push(`- Parse ${label}: **${ok ? 'pass' : 'FAIL'}** (${tree.pillars.length} pillars, ${tree.nodes.length} nodes, useEffect ${ue ? 'present' : 'missing'}, demo question routes ${routed === ue?.key ? 'to it' : 'elsewhere'}, ${time})`);
      out.push(`### ${label}: ${tree.title} (${time})`, '');
      for (const p of tree.pillars) {
        out.push(`- **${p}**`);
        for (const n of tree.nodes.filter((n) => n.pillar === p)) {
          out.push(`  - \`${n.key}\` ${n.concept_name} · L${n.required_blooms_level} ${n.size} · ${n.icon} · [${n.keywords.join(', ')}] · deps [${n.depends_on.join(', ')}]  \n    ${n.mastery_criteria}`);
        }
      }
      out.push('');
    } catch (e) {
      summary.push(`- Parse ${label}: **ERROR** ${(e as Error).message}`);
    }
  }
}

// ---- 3-turn sandbox exchange (mirrors contracts §4 in DEMO_MODE) ------------
if (runs('exchange')) {
  out.push('## 3-turn sandbox exchange', '');
  const show = (who: string, s: string) => out.push(`**${who}:**`, '', s, '');
  // Turn 1: L1, quiz attached.
  const t1 = intel.buildFrictionPrompt({ raw_prompt: DEMO_PROMPTS.question, level: 1, node, includeQuiz: true });
  const r1 = await reply([{ role: 'user', content: t1 }]);
  show('Student (L1)', DEMO_PROMPTS.question);
  show(`Claude (first token ${r1.ttft})`, r1.text);
  // Turn 2: the answer is graded against turn 1's reply; feedback goes into the prompt at the new level.
  const g = await intel.evaluateExchange({ node, level: 1, quiz_text: r1.text, student_message: DEMO_PROMPTS.correctAnswer, demoMode: true });
  const t2 = intel.buildFrictionPrompt({ raw_prompt: DEMO_PROMPTS.correctAnswer, level: g.new_level, node, includeQuiz: g.new_level < 4, feedback: { verdict: g.verdict } });
  const r2 = await reply([
    { role: 'user', content: DEMO_PROMPTS.question },
    { role: 'assistant', content: r1.text },
    { role: 'user', content: t2 },
  ]);
  show(`Student (graded ${g.verdict} ${g.confidence.toFixed(2)} → L${g.new_level}: ${g.rationale})`, DEMO_PROMPTS.correctAnswer);
  show(`Claude (first token ${r2.ttft})`, r2.text);
  // Turn 3: new chat, same question, now L4 → no block at all.
  const t3 = intel.buildFrictionPrompt({ raw_prompt: DEMO_PROMPTS.question, level: g.new_level, node, includeQuiz: false });
  const r3 = await reply([{ role: 'user', content: t3 }]);
  show(`Student, new chat (L${g.new_level}${t3.includes(FRICTION_OPEN) ? ', block attached' : ', no block'})`, DEMO_PROMPTS.question);
  show(`Claude (first token ${r3.ttft})`, r3.text);
  const fails = [
    ...(await score(1, r1.text)).map((f) => `turn 1 ${f}`),
    ...(g.verdict === 'correct' ? [] : [`turn 2 graded ${g.verdict}`]),
    ...(LEAK.test(r2.text) ? ['turn 2 leaks'] : []),
    ...(await score(4, r3.text)).map((f) => `turn 3 ${f}`),
  ];
  summary.push(`- 3-turn exchange: **${fails.length ? `FAIL (${fails.join('; ')})` : 'pass'}** (automatic checks; read the transcript for naturalness)`);
}

out.splice(4, 0, '## Summary', '', ...summary, '');
const file = fileURLToPath(new URL('./results/latest.md', import.meta.url));
writeFileSync(file, out.join('\n'));
console.log(summary.join('\n'));
console.log(`\nwrote ${file}`);
