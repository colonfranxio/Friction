import type { Context } from 'hono';
import { badRequest } from '../errors';

/** Parses a JSON body. Empty body → undefined; malformed JSON → 400 bad_request. */
export async function readJson<T = unknown>(c: Context): Promise<T | undefined> {
  const raw = await c.req.text();
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw badRequest('invalid JSON body');
  }
}

/** Like readJson but the body must be a JSON object. */
export async function readObject<T extends object = Record<string, unknown>>(c: Context): Promise<Partial<T>> {
  const body = await readJson<unknown>(c);
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('JSON object body required');
  }
  return body as Partial<T>;
}

export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
