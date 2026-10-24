import Anthropic from '@anthropic-ai/sdk';

export interface Models {
  parse: string;
  grade: string;
  chat: string;
  classify: string;
}

export interface IntelligenceOptions {
  /** Inject a client (tests). Default: built lazily from env on first use. */
  client?: Anthropic;
  /** Override model IDs. Default: MODEL_* env vars. */
  models?: Partial<Models>;
}

function envModel(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
}

/** Resolves config lazily so importing this package never needs a key or env. */
export function makeConfig(opts: IntelligenceOptions = {}) {
  let client = opts.client;
  return {
    client(): Anthropic {
      // Grading sits on a 4s hot path but late grades still apply, so allow one retry within ~20s.
      return (client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 }));
    },
    model(kind: keyof Models): string {
      return opts.models?.[kind] ?? envModel(`MODEL_${kind.toUpperCase()}`);
    },
  };
}

export type Config = ReturnType<typeof makeConfig>;
