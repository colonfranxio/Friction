import { ICON_KEYWORDS } from '@friction/shared';
import { z } from 'zod';

export const GradeSchema = z.object({
  verdict: z.enum(['correct', 'partial', 'incorrect', 'not_an_answer', 'lazy']),
  confidence: z.number(),
  rationale: z.string(),
});

/** Index into the numbered concept list we send, or null when no concept fits. */
export const ClassifySchema = z.object({
  concept: z.number().int().nullable(),
  confidence: z.number(),
});

export const ParsedTreeSchema = z.object({
  title: z.string(),
  pillars: z.array(z.string()),
  nodes: z.array(
    z.object({
      key: z.string(),
      pillar: z.string(),
      concept_name: z.string(),
      mastery_criteria: z.string(),
      required_blooms_level: z.number().int(),
      size: z.enum(['major', 'minor']),
      icon: z.enum(ICON_KEYWORDS),
      keywords: z.array(z.string()),
      depends_on: z.array(z.string()),
    }),
  ),
});
