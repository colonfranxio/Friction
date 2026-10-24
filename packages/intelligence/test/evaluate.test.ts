import type Anthropic from '@anthropic-ai/sdk';
import { buildSeed, DEMO_PROMPTS } from '@friction/shared';
import { describe, expect, it, vi } from 'vitest';
import { createIntelligence } from '../src/index';

const node = buildSeed().nodes.find((n) => n.concept_name === 'React useEffect')!;
const QUIZ = 'Quick check: what does the dependency array tell React?';

function fakeClient(reply: object) {
  const parse = vi.fn().mockResolvedValue({ stop_reason: 'end_turn', ...reply });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}
const intel = (client: Anthropic) => createIntelligence({ client, models: { grade: 'test-grade-model' } });
const base = { node, level: 1 as const, quiz_text: QUIZ, student_message: DEMO_PROMPTS.correctAnswer, demoMode: false };

describe('evaluateExchange', () => {
  it('sends a structured, low-effort request with the right model and context', async () => {
    const { client, parse } = fakeClient({ parsed_output: { verdict: 'correct', confidence: 0.9, rationale: 'Explains deps.' } });
    const signal = new AbortController().signal;
    await intel(client).evaluateExchange({ ...base, signal });
    const [params, opts] = parse.mock.calls[0];
    expect(params.model).toBe('test-grade-model');
    expect(params.output_config.effort).toBe('low');
    expect(params.output_config.format).toBeTruthy();
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('tool_choice');
    expect(params.messages.at(-1).role).toBe('user');
    const content = params.messages[0].content as string;
    expect(content).toContain(node.mastery_criteria);
    expect(content).toContain(QUIZ);
    expect(content).toContain(DEMO_PROMPTS.correctAnswer);
    expect(content).toMatch(/level: 1 of 4 \(Remember \/ Understand\)/);
    expect(opts.signal).toBe(signal);
  });

  it('computes new_level with the shared rule', async () => {
    const { client } = fakeClient({ parsed_output: { verdict: 'correct', confidence: 0.9, rationale: 'ok' } });
    expect((await intel(client).evaluateExchange(base)).new_level).toBe(2);
    expect((await intel(client).evaluateExchange({ ...base, demoMode: true })).new_level).toBe(4);
  });

  it('lazy at L3 drops a level', async () => {
    const { client } = fakeClient({ parsed_output: { verdict: 'lazy', confidence: 0.9, rationale: 'Asked for code.' } });
    const r = await intel(client).evaluateExchange({ ...base, level: 3, student_message: DEMO_PROMPTS.lazyAnswer });
    expect(r).toMatchObject({ verdict: 'lazy', new_level: 2 });
  });

  it('missing quiz text lowers confidence and says so in the prompt', async () => {
    const { client, parse } = fakeClient({ parsed_output: { verdict: 'correct', confidence: 1, rationale: 'ok' } });
    const r = await intel(client).evaluateExchange({ ...base, quiz_text: null, demoMode: true });
    expect(r.confidence).toBeCloseTo(0.8);
    expect(parse.mock.calls[0][0].messages[0].content).toMatch(/not captured/);
  });

  it('a repeated or rephrased original question never earns a level, even in demo mode', async () => {
    const { client, parse } = fakeClient({ parsed_output: { verdict: 'not_an_answer', confidence: 0.95, rationale: 'Asked again.' } });
    for (const student_message of [DEMO_PROMPTS.question, 'Why does my useEffect keep re-running, and what goes in the dependency array?']) {
      const r = await intel(client).evaluateExchange({ ...base, student_message, demoMode: true });
      expect(r.new_level).toBe(1);
    }
    // The student's message is sent as its own labelled section, separate from the question it answers.
    expect(parse.mock.calls[0][0].messages[0].content).toMatch(/Question asked: [^\n]+\n\nStudent's message:\nHow do I stop my useEffect/);
  });

  it('clamps confidence to 0..1', async () => {
    const { client } = fakeClient({ parsed_output: { verdict: 'partial', confidence: 7, rationale: 'ok' } });
    expect((await intel(client).evaluateExchange(base)).confidence).toBe(1);
  });

  it('throws on refusal / max_tokens / unparsed output', async () => {
    for (const reply of [
      { stop_reason: 'refusal', parsed_output: null },
      { stop_reason: 'max_tokens', parsed_output: null },
      { parsed_output: null },
    ]) {
      const { client } = fakeClient(reply);
      await expect(intel(client).evaluateExchange(base)).rejects.toThrow(/unusable response/);
    }
  });

  it('propagates API errors', async () => {
    const parse = vi.fn().mockRejectedValue(new Error('529 overloaded'));
    const client = { messages: { parse } } as unknown as Anthropic;
    await expect(intel(client).evaluateExchange(base)).rejects.toThrow('529 overloaded');
  });
});
