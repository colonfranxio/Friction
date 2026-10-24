import { DEMO_PROMPTS, type BloomLevel, type Verdict } from '@friction/shared';

export const SAMPLES_PER_LEVEL = 5;
export const LEVELS: BloomLevel[] = [1, 2, 3, 4];
/** Levels that gate CP2; L3 is reported but only gates CP3. */
export const CP2_LEVELS: BloomLevel[] = [1, 2, 4];

/** A typical L1 check question, used as quiz_text for the grading cases. The levels section also grades the demo answer against each real L1 reply. */
export const QUIZ = 'In your own words, what does the dependency array tell React?';

/** `expect` lists every acceptable verdict. Only `correct` raises a level, so the repeat cases just must not be `correct`. */
export const GRADING_CASES: { name: string; level: BloomLevel; message: string; expect: Verdict | Verdict[] }[] = [
  // Repeating or rephrasing the original question must not earn mastery, however many concept keywords it has.
  { name: 'repeats original question', level: 1, message: DEMO_PROMPTS.question, expect: ['not_an_answer', 'lazy'] },
  {
    name: 'rephrases original question',
    level: 1,
    message: 'Why does my useEffect keep re-running forever, and what should I put in the dependency array to stop it?',
    expect: ['not_an_answer', 'lazy'],
  },
  { name: 'echoes the check question', level: 1, message: QUIZ, expect: ['not_an_answer', 'lazy'] },
  { name: 'keyword list', level: 1, message: 'useEffect dependency array React re-run effect values change', expect: ['not_an_answer', 'partial', 'lazy'] },
  // Genuine answers that are short or phrased as a question still count.
  { name: 'short genuine answer', level: 1, message: 'It re-runs the effect only when one of those values changes.', expect: 'correct' },
  {
    name: 'question-shaped answer',
    level: 1,
    message: "Isn't it the list of values the effect uses, so React only re-runs it when one of them changes?",
    expect: 'correct',
  },
  { name: 'demo correctAnswer', level: 1, message: DEMO_PROMPTS.correctAnswer, expect: 'correct' },
  { name: 'demo lazyAnswer at L3', level: 3, message: DEMO_PROMPTS.lazyAnswer, expect: 'lazy' },
  {
    name: 'partial',
    level: 1,
    message: "It's the array you pass as the second argument. I think it controls the effect somehow but I'm not sure how.",
    expect: 'partial',
  },
  {
    name: 'incorrect',
    level: 1,
    message: 'The dependency array lists the state variables the effect is allowed to change, so React blocks any other updates inside the effect.',
    expect: 'incorrect',
  },
  { name: 'not_an_answer', level: 1, message: 'btw how do I center a div with flexbox?', expect: 'not_an_answer' },
];

/** Prompts that miss the keyword stage, to exercise the LLM fallback. */
export const CLASSIFY_CASES: { prompt: string; expect: string | null }[] = [
  // Avoid seed keywords (e.g. "component" routes to JSX by design) so these reach the LLM stage.
  { prompt: 'How can I share the current theme with deeply nested parts of my app without handing it down manually at every level?', expect: 'Context API' },
  { prompt: 'Why does my list re-render every time its parent does, even when its data did not change?', expect: 'Performance & Memoization' },
  { prompt: 'write a haiku about autumn leaves', expect: null },
];
