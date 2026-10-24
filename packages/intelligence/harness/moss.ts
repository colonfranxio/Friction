// Explicit standalone experiment; normal API startup never enables this adapter.
import { buildSeed } from '@friction/shared';
import Anthropic from '@anthropic-ai/sdk';
import { createIntelligence, keywordClassify } from '../src/index';
import { mossFromEnv } from '../src/moss';
import { within } from '../src/retrieval';
import { mossCases } from './moss-cases';

const withClaude = process.argv.includes('--with-claude');
const checkSdk = process.argv.includes('--check-sdk');

function observedClient() {
  const real = new Anthropic();
  let last = { status: 'not_called', inputCharacters: 0, inputTokens: 0, outputTokens: 0 };
  const parse = async (...args: Parameters<typeof real.messages.parse>) => {
    last.inputCharacters = JSON.stringify(args[0].messages).length;
    try {
      const reply = await real.messages.parse(...args);
      last.status = reply.stop_reason === 'end_turn' && reply.parsed_output ? 'valid_output' : 'invalid_output';
      last.inputTokens = reply.usage.input_tokens;
      last.outputTokens = reply.usage.output_tokens;
      return reply;
    } catch (error) {
      last.status = 'provider_error';
      throw error;
    }
  };
  return {
    client: { messages: { parse } } as unknown as Anthropic,
    reset() { last = { status: 'not_called', inputCharacters: 0, inputTokens: 0, outputTokens: 0 }; },
    read: () => ({ ...last }),
  };
}

async function main() {
  if (checkSdk) {
    const { MossClient } = await import('@moss-js/moss');
    const client = new MossClient('feasibility-probe', 'not-a-real-key');
    await client.close();
    console.log(JSON.stringify({ status: 'native_load_pass', platform: process.platform, authenticated: false }));
    return;
  }
  const retriever = mossFromEnv();
  if (!retriever) {
    console.log(JSON.stringify({ status: 'credentials_missing', required: ['MOSS_PROJECT_ID', 'MOSS_PROJECT_KEY'], liveRetrieval: 'not_run' }));
    process.exitCode = 2;
    return;
  }
  if (withClaude && (!process.env.ANTHROPIC_API_KEY || !process.env.MODEL_CLASSIFY)) {
    console.log(JSON.stringify({ status: 'claude_configuration_missing', liveRetrieval: 'not_run' }));
    process.exitCode = 2;
    return;
  }
  const nodes = buildSeed().nodes;
  const names = new Map(nodes.map((n) => [n.id, n.concept_name]));
  try {
    const started = performance.now();
    if (!await retriever.prepare(nodes)) {
      console.log(JSON.stringify({ status: 'preparation_failed', coldMs: Math.round(performance.now() - started), detail: 'Check credentials, connectivity, model availability and native runtime. Provider errors are suppressed to protect secrets.' }));
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({ status: 'prepared', coldMs: Math.round(performance.now() - started), documents: nodes.length, cloudIndexWrites: false }));
    const baselineCalls = withClaude ? observedClient() : undefined;
    const experimentCalls = withClaude ? observedClient() : undefined;
    const baseline = createIntelligence({ client: baselineCalls?.client });
    const experiment = createIntelligence({ client: experimentCalls?.client, curriculumRetriever: retriever });
    const timings: number[] = [];
    let keywordCorrect = 0;
    let recallHits = 0;
    let positives = 0;
    let baselineCorrect = 0;
    let experimentCorrect = 0;
    let baselineNegativeCorrect = 0;
    let experimentNegativeCorrect = 0;
    let unhealthyResults = 0;
    const nameOf = (id: string | null) => id ? names.get(id) ?? null : null;
    for (const test of mossCases) {
      const matches = (actual: string | null) => Array.isArray(test.expected)
        ? actual !== null && test.expected.includes(actual) : actual === test.expected;
      const kw = keywordClassify(test.prompt, nodes);
      const t0 = performance.now();
      const ids = await within(retriever.retrieve(test.prompt, nodes), 200, [] as string[]);
      const retrievalMs = performance.now() - t0;
      timings.push(retrievalMs);
      const retrieved = ids.map((id) => nameOf(id));
      keywordCorrect += Number(matches(nameOf(kw.node_id)));
      if (test.expected) { positives++; recallHits += Number(retrieved.some(matches)); }
      let comparison: object = {};
      if (withClaude) {
        baselineCalls!.reset();
        experimentCalls!.reset();
        const t1 = performance.now();
        const a = await baseline.classifyTopic(test.prompt, nodes);
        const baselineMs = performance.now() - t1;
        const t2 = performance.now();
        const b = await experiment.classifyTopic(test.prompt, nodes);
        const experimentMs = performance.now() - t2;
        const baselineHealth = baselineCalls!.read();
        const experimentHealth = experimentCalls!.read();
        const healthy = (status: string) => status === 'valid_output' || (status === 'not_called' && kw.node_id !== null);
        const baselineOk = healthy(baselineHealth.status);
        const experimentOk = healthy(experimentHealth.status);
        unhealthyResults += Number(!baselineOk) + Number(!experimentOk);
        baselineCorrect += Number(baselineOk && matches(nameOf(a.node_id)));
        experimentCorrect += Number(experimentOk && matches(nameOf(b.node_id)));
        if (test.expected === null) {
          baselineNegativeCorrect += Number(baselineOk && a.node_id === null);
          experimentNegativeCorrect += Number(experimentOk && b.node_id === null);
        }
        comparison = { baseline: nameOf(a.node_id), experiment: nameOf(b.node_id), baselineMs: Math.round(baselineMs), experimentMs: Math.round(experimentMs), baselineHealth, experimentHealth };
      }
      console.log(JSON.stringify({ kind: test.kind, prompt: test.prompt, expected: test.expected, keyword: nameOf(kw.node_id), retrieved, retrievalMs: Math.round(retrievalMs), ...comparison }));
    }
    timings.sort((a, b) => a - b);
    const pct = (p: number) => Math.round(timings[Math.min(timings.length - 1, Math.ceil(timings.length * p) - 1)]);
    console.log(JSON.stringify({
      status: 'complete', cases: mossCases.length, keywordCorrect,
      retrievalRecallAt3: recallHits / positives, warmRetrievalP50Ms: pct(0.5), warmRetrievalP95Ms: pct(0.95),
      baselineCorrect: withClaude ? baselineCorrect : 'not_run',
      experimentCorrect: withClaude ? experimentCorrect : 'not_run',
      baselineNegativeCorrect: withClaude ? baselineNegativeCorrect : 'not_run',
      experimentNegativeCorrect: withClaude ? experimentNegativeCorrect : 'not_run',
      unhealthyResults: withClaude ? unhealthyResults : 'not_run',
      context: 'complete canonical catalog plus up to three candidate numbers; no token reduction claimed',
      decision: 'manual review required; retrieval recall alone is not a product-quality gate',
    }));
  } finally {
    await retriever.close();
  }
}

main().catch(() => {
  console.error('Moss trial failed. Provider details suppressed; check local configuration.');
  process.exitCode = 1;
});
