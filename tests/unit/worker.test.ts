import { describe, expect, it } from 'vitest';
import { handleRequest, type RuntimeEnv } from '../../worker/index';

function environment(databaseResult: 'reachable' | 'unavailable' = 'reachable'): RuntimeEnv {
  return {
    ENVIRONMENT: 'test',
    APP_VERSION: '0.1.0',
    BUILDER_ORIGIN: 'https://appbuilder.pointatx.org',
    AUTHENTICATION_ENABLED: 'true',
    PUBLISHING_ENABLED: 'true',
    ASSETS: {
      fetch: async () => new Response('<!doctype html><title>PointApp Builder</title>'),
    },
    DB: {
      prepare: (query: string) => ({
        first: async () => {
          if (databaseResult === 'unavailable') throw new Error('D1 unavailable');
          return query.includes('SELECT 1 AS ok') ? { ok: 1 } : null;
        },
      }),
    } as unknown as D1Database,
    BOOTSTRAP_OWNER_GITHUB_ID: '1202831',
  };
}

describe('PointApp Builder Worker boundary', () => {
  it('reports the runtime version and reachable isolated database', async () => {
    const response = await handleRequest(
      new Request('https://appbuilder.pointatx.org/api/health'),
      environment(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      status: 'ok',
      service: 'pointapp-builder',
      environment: 'test',
      version: '0.1.0',
      checks: { database: 'ok', authentication: 'ok', publishing: 'ok' },
    });
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('fails health checks when D1 is unavailable', async () => {
    const response = await handleRequest(
      new Request('https://appbuilder.pointatx.org/api/health'),
      environment('unavailable'),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: 'degraded',
      checks: { database: 'unavailable' },
    });
  });

  it.each([
    ['/api/drafts', 401, 'UNAUTHENTICATED'],
    ['/auth/login', 503, 'AUTH_UNAVAILABLE'],
    ['/content/v1/channels/production', 404, 'PRODUCTION_NOT_PUBLISHED'],
  ])('returns a safe problem for unavailable route %s', async (path, status, code) => {
    const response = await handleRequest(
      new Request(`https://appbuilder.pointatx.org${path}`),
      environment(),
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({
      status,
      code,
    });
  });

  it('allows only GET for the health endpoint', async () => {
    const response = await handleRequest(
      new Request('https://appbuilder.pointatx.org/api/health', { method: 'POST' }),
      environment(),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('redirects plain HTTP to the same HTTPS path', async () => {
    const response = await handleRequest(
      new Request('http://appbuilder.pointatx.org/library?device=tablet'),
      environment(),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://appbuilder.pointatx.org/library?device=tablet',
    );
  });

  it('delegates non-API HTTPS requests to the static asset binding', async () => {
    const response = await handleRequest(
      new Request('https://appbuilder.pointatx.org/library'),
      environment(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>PointApp Builder</title>');
  });

  it('does not redirect local HTTP development traffic to unavailable TLS', async () => {
    const response = await handleRequest(new Request('http://127.0.0.1:4173/'), environment());

    expect(response.status).toBe(200);
  });
});
