import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ICON_KEYWORDS, type ParsedTree, type SyllabusInput } from '@friction/shared';
import type { Config } from './config';
import { ParsedTreeSchema } from './schemas';
import { validateTree } from './validate';

const INSTRUCTION = `Turn this course syllabus into a skill tree for a programming course.

- title: the course name.
- pillars: 3 to 5 course modules, in teaching order.
- nodes: 6 to 15 core concepts a student must master. For each:
  - key: a short unique id like "n1".
  - pillar: exactly one of the pillar names.
  - concept_name: a short name a student would recognize (e.g. "React useEffect").
  - mastery_criteria: one concrete, observable skill ("Explains when an effect re-runs and why the dependency array matters").
  - required_blooms_level: 1-4 (Bloom level needed to master it). Usually 3 or 4; use 4 for milestone concepts.
  - size: "major" for milestone concepts, otherwise "minor".
  - icon: the best fit from: ${ICON_KEYWORDS.join(', ')}.
  - keywords: 3 to 7 lowercase words or short phrases a student would actually type when asking about it (APIs, error messages, jargon). Avoid generic words like "code" or "help".
  - depends_on: keys of the prerequisite concepts. No cycles.`;

export async function parseSyllabus(cfg: Config, input: SyllabusInput): Promise<ParsedTree> {
  const source: Anthropic.ContentBlockParam =
    input.kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.base64 } }
      : { type: 'text', text: `<syllabus>\n${input.text}\n</syllabus>` };

  // Streaming so a long high-effort parse never hits a request timeout; A enforces the 90s limit.
  const stream = cfg.client().messages.stream({
    model: cfg.model('parse'),
    max_tokens: 32000,
    output_config: { effort: 'high', format: zodOutputFormat(ParsedTreeSchema) },
    messages: [{ role: 'user', content: [source, { type: 'text', text: INSTRUCTION }] }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason !== 'end_turn' || !msg.parsed_output) {
    throw new Error(`parseSyllabus: unusable response (stop_reason=${msg.stop_reason})`);
  }
  return validateTree(msg.parsed_output as ParsedTree);
}
