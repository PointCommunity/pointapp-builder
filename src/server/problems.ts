export type ProblemFields = Record<string, string[]>;

export class ProblemError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: ProblemFields,
  ) {
    super(message);
    this.name = 'ProblemError';
  }
}

function problemType(code: string): string {
  return `https://appbuilder.pointatx.org/problems/${code.toLowerCase().replaceAll('_', '-')}`;
}

export function problemResponse(error: unknown, requestId: string): Response {
  const safe = toProblemError(error);

  return Response.json(
    {
      type: problemType(safe.code),
      title: safe.message,
      status: safe.status,
      code: safe.code,
      requestId,
      ...(safe.fields ? { fields: safe.fields } : {}),
    },
    {
      status: safe.status,
      headers: { 'content-type': 'application/problem+json; charset=utf-8' },
    },
  );
}

export function toProblemError(error: unknown): ProblemError {
  if (error instanceof ProblemError) return error;
  if (error instanceof ZodError) {
    const fields: ProblemFields = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || 'request';
      (fields[path] ??= []).push(issue.message);
    }
    return new ProblemError(400, 'VALIDATION_FAILED', 'Correct the highlighted fields', fields);
  }
  return new ProblemError(500, 'INTERNAL_ERROR', 'The request could not be completed');
}
import { ZodError } from 'zod';
