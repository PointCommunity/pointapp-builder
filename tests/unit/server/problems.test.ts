import { describe, expect, it } from 'vitest';
import { ProblemError, problemResponse } from '../../../src/server/problems';
import { z } from 'zod';

describe('safe API problems', () => {
  it('serializes a typed problem with a correlation ID and field errors', async () => {
    const response = problemResponse(
      new ProblemError(400, 'INVALID_INPUT', 'Review the highlighted fields', {
        name: ['Name is required'],
      }),
      '25d9f45b-03df-4190-bb50-23211d5cc832',
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toEqual({
      type: 'https://appbuilder.pointatx.org/problems/invalid-input',
      title: 'Review the highlighted fields',
      status: 400,
      code: 'INVALID_INPUT',
      requestId: '25d9f45b-03df-4190-bb50-23211d5cc832',
      fields: { name: ['Name is required'] },
    });
  });

  it('does not expose unexpected exception messages or stacks', async () => {
    const response = problemResponse(
      new Error('D1 says token=super-secret at users.sql:12'),
      '0c5df84c-d37d-4e16-8669-a566513ee42f',
    );
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain('INTERNAL_ERROR');
    expect(text).not.toContain('super-secret');
    expect(text).not.toContain('users.sql');
  });

  it('returns bounded field errors for schema validation failures', async () => {
    const error = z.strictObject({ name: z.string().min(3) }).safeParse({ name: '' }).error;
    const response = problemResponse(error, '0c5df84c-d37d-4e16-8669-a566513ee42f');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { name: expect.any(Array) },
    });
  });
});
