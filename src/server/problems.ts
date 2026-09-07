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
  const safe =
    error instanceof ProblemError
      ? error
      : new ProblemError(500, 'INTERNAL_ERROR', 'The request could not be completed');

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
