import { describe, expect, it } from 'vitest';
import {
  applySecurityHeaders,
  readJsonMutation,
  requireMutationHeaders,
} from '../../../src/server/security';
import { ProblemError } from '../../../src/server/problems';

const origin = 'https://appbuilder.pointatx.org';

function mutation(headers: HeadersInit = {}, body = '{}') {
  return new Request(`${origin}/api/drafts`, {
    method: 'POST',
    headers: {
      origin,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      'idempotency-key': '4ddde8e1-a3f5-46b6-a900-3837da842356', // gitleaks:allow - UUID fixture
      ...headers,
    },
    body,
  });
}

describe('mutation request security', () => {
  it.each([
    [{ origin: 'https://evil.example' }, 'ORIGIN_DENIED'],
    [{ 'sec-fetch-site': 'cross-site' }, 'FETCH_METADATA_DENIED'],
    [{ 'content-type': 'text/plain' }, 'CONTENT_TYPE_REQUIRED'],
    [{ 'idempotency-key': 'short' }, 'IDEMPOTENCY_REQUIRED'],
  ])('rejects unsafe headers with a typed problem', (headers, code) => {
    expect(() =>
      requireMutationHeaders(mutation(headers), origin, ['application/json'], 1024),
    ).toThrow(expect.objectContaining<Partial<ProblemError>>({ code }));
  });

  it('rejects a body whose actual UTF-8 size exceeds the bound', async () => {
    await expect(
      readJsonMutation(mutation({}, JSON.stringify({ value: '£££' })), origin, 8),
    ).rejects.toMatchObject({
      status: 413,
      code: 'REQUEST_TOO_LARGE',
    });
  });

  it('accepts valid JSON with an exact same-origin request', async () => {
    await expect(readJsonMutation(mutation({}, '{"ok":true}'), origin, 64)).resolves.toEqual({
      ok: true,
    });
  });
});

describe('security response headers', () => {
  it('applies restrictive browser headers and a caller-selected cache policy', () => {
    const response = applySecurityHeaders(new Response('ok'), {
      cacheControl: 'public, max-age=60',
    });

    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('permissions-policy')).toContain('camera=()');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });
});
