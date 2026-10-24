import type { ApiErrorBody, ErrorCode } from '@friction/shared';

export class HttpError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 500 | 502 | 504,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);
export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found`);
