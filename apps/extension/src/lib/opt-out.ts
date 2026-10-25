/**
 * "Ignore friction for this": a student asking Claude to drop Friction's notes. The notes ride in the student's
 * own message, so Claude would obey; the content script holds such a message and points to Bypass instead.
 * Deliberately narrow: physics wording ("no friction", "without friction", "ignoring friction") must pass, and a
 * held physics "ignore friction" costs only a second Enter.
 * ponytail: phrase list, not a classifier; rephrasings get through and the template's own rule is the backstop.
 */
const PATTERNS = [
  /\b(ignore|skip|disable|bypass|disregard|forget|override|drop|remove|stop(?: using)?|(?:turn|switch) off)\s+(?:the\s+|this\s+|your\s+|all\s+)?friction\b/i,
  /\bfriction\s+off\b/i,
  /\b(ignore|disregard|forget|skip)\s+(?:the\s+|those\s+|these\s+|your\s+|all\s+)?(?:private|tutor|hidden|friction)\s+(notes|instructions)\b/i,
];

export const isOptOut = (text: string): boolean => PATTERNS.some((p) => p.test(text));
