import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { computeNextLevel, type EvaluateInput, type EvaluationResult } from '@friction/shared';
import type { Config } from './config';
import { GradeSchema } from './schemas';

/** EvaluateInput plus an optional abort signal (see change request in docs/status/B-intelligence.md). */
export type EvaluateArgs = EvaluateInput & { signal?: AbortSignal };

const SYSTEM = `You grade a student's message as their answer to a tutor's check-for-understanding question.

Verdicts:
- correct: demonstrates the idea in the learning goal.
- partial: on the right track but missing the key point.
- incorrect: shows a misconception.
- not_an_answer: not answering the question (a new question, chit-chat, off-topic).
- lazy: asks for the answer or code without engaging (e.g. "just give me the code").

confidence is 0 to 1. rationale is one plain sentence an educator can read; do not quote the student verbatim.`;

export async function evaluateExchange(cfg: Config, input: EvaluateArgs): Promise<EvaluationResult> {
  const { node, level, quiz_text, student_message, demoMode, signal } = input;
  const prompt = [
    `Concept: ${node.concept_name}`,
    `Learning goal: ${node.mastery_criteria}`,
    `Question asked: ${quiz_text ?? '(not captured; grade against the learning goal)'}`,
    `Student's message:\n${student_message}`,
  ].join('\n\n');

  const res = await cfg.client().messages.parse(
    {
      model: cfg.model('grade'),
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { effort: 'low', format: zodOutputFormat(GradeSchema) },
      messages: [{ role: 'user', content: prompt }],
    },
    { signal },
  );
  if (res.stop_reason !== 'end_turn' || !res.parsed_output) {
    throw new Error(`evaluateExchange: unusable response (stop_reason=${res.stop_reason})`);
  }

  const { verdict, rationale } = res.parsed_output;
  let confidence = Math.max(0, Math.min(1, res.parsed_output.confidence));
  if (quiz_text === null) confidence *= 0.8;
  return {
    verdict,
    confidence,
    rationale,
    new_level: computeNextLevel({ current: level, verdict, confidence, demoMode }),
  };
}
