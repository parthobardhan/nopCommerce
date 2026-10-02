export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'malformed_response';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly details: string[];

  constructor(kind: ApiErrorKind, message: string, options?: { status?: number; details?: string[] }) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options?.status;
    this.details = options?.details ?? [];
  }

  static fromStatus(status: number, body: unknown): ApiError {
    const details = extractErrorMessages(body);
    const message = details[0] ?? `Request failed with status ${status}`;
    if (status === 401 || status === 403) return new ApiError('unauthorized', message, { status, details });
    if (status === 404) return new ApiError('not_found', message, { status, details });
    if (status >= 400 && status < 500) return new ApiError('validation', message, { status, details });
    return new ApiError('server', message, { status, details });
  }
}

/** Pulls human-readable messages out of the error shapes the Web API returns. */
export function extractErrorMessages(body: unknown): string[] {
  if (!body || typeof body !== 'object') return typeof body === 'string' && body.trim() ? [body] : [];
  const record = body as Record<string, unknown>;
  const out: string[] = [];
  for (const key of ['errors', 'warnings', 'messages']) {
    const value = record[key];
    if (Array.isArray(value)) out.push(...value.filter((v): v is string => typeof v === 'string'));
    else if (value && typeof value === 'object') {
      for (const inner of Object.values(value as Record<string, unknown>)) {
        if (Array.isArray(inner)) out.push(...inner.filter((v): v is string => typeof v === 'string'));
        else if (typeof inner === 'string') out.push(inner);
      }
    }
  }
  for (const key of ['message', 'title', 'detail']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) out.push(value);
  }
  return out;
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
