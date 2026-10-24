import { z } from 'zod';

export const GradeSchema = z.object({
  verdict: z.enum(['correct', 'partial', 'incorrect', 'not_an_answer', 'lazy']),
  confidence: z.number(),
  rationale: z.string(),
});
