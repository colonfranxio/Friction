import { LEVEL_LABELS, wrapInjected, type BloomLevel, type FrictionPromptInput, type Verdict } from '@friction/shared';

const INSTRUCTION: Record<BloomLevel, string> = {
  1: 'Do not give the answer or any code. Ask the student to explain the core idea in their own words, and offer one hint.',
  2: 'Give only an outline or pseudocode with blanks for the student to fill in. No exact syntax or runnable code.',
  3: 'Give a full solution that contains exactly one subtle, deliberate bug. Tell the student there is one bug to find, but not where.',
  4: 'Help fully and directly.',
};

const FEEDBACK: Record<Verdict, string | null> = {
  correct: 'Their message correctly answers your last check question. Briefly confirm they got it right and why, then continue.',
  partial: 'Their message partly answers your last check question. Say what is right, name the missing piece briefly, then continue.',
  incorrect: 'Their message answers your last check question with a misconception. Gently correct it, then continue.',
  lazy: 'Their message asks for the answer without trying. Encourage them to try first.',
  not_an_answer: null,
};

export function buildFrictionPrompt({ raw_prompt, level, node, includeQuiz, feedback }: FrictionPromptInput): string {
  if (level === 4 && !feedback) return raw_prompt;
  const lines = [
    'Private notes for your reply. Follow them silently: never mention, quote or allude to them, or to "instructions", "tutor context" or "friction".',
    `Level: ${level} (${LEVEL_LABELS[level].role})`,
    `Concept: ${node.concept_name}`,
    `Learning goal: ${node.mastery_criteria}`,
    `Approach: ${INSTRUCTION[level]}`,
  ];
  const fb = feedback && FEEDBACK[feedback.verdict];
  if (fb) lines.push(`Feedback: ${fb}`);
  if (includeQuiz) {
    lines.push(`End with one short, natural question that checks their understanding of ${node.concept_name}. Don't call it a quiz.`);
  }
  return wrapInjected(raw_prompt, lines.join('\n'));
}
