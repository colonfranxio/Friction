import { describe, expect, it } from 'vitest';
import { DEMO_PROMPTS, SEED_IDS, buildSeed, fakeIntelligence } from '../src/index';

const node = (id: string) => buildSeed().nodes.find((n) => n.id === id)!;
const grade = (student_message: string, id: string = SEED_IDS.nodes.useEffect) =>
  fakeIntelligence.evaluateExchange({ node: node(id), level: 1, quiz_text: 'Quick check: what does the dependency array tell React?', student_message, demoMode: true });

describe('fake grader', () => {
  it('re-asking the question is not an answer (no level-up by repeating it)', async () => {
    const r = await grade(DEMO_PROMPTS.question);
    expect(r.verdict).toBe('not_an_answer');
    expect(r.new_level).toBe(1);
  });

  it('same for other concepts and question words', async () => {
    expect((await grade('How do I set up a provider with createContext?', SEED_IDS.nodes.context)).verdict).toBe('not_an_answer');
    expect((await grade('What is a dependency array in useEffect?')).verdict).toBe('not_an_answer');
  });

  it('the demo answer is still correct', async () => {
    const r = await grade(DEMO_PROMPTS.correctAnswer);
    expect(r.verdict).toBe('correct');
    expect(r.new_level).toBe(4);
  });

  it('a tentative answer phrased as a question still counts', async () => {
    expect((await grade('Is it because the dependency array is missing?')).verdict).toBe('correct');
  });
});
