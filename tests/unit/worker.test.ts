import { describe, expect, it } from 'vitest';
import { handleRequest, type RuntimeEnv } from '../../worker/index';

function environment(databaseResult: 'reachable' | 'unavailable' = 'reachable'): RuntimeEnv {
  return {
    ENVIRONMENT: 'test',
    APP_VERSION: '0.1.0',
    BUILDER_ORIGIN: 'https://appbuilder.pointatx.org',
    AUTHENTICATION_ENABLED: 'false',
    PUBLISHING_ENABLED: 'false',
    ASSETS: {
      fetch: async () => new Response('<!doctype html><title>PointApp Builder</title>'),
    },
    DB: {
      prepare: () => ({
        first: async () => {
          if (databaseResult === 'unavailable') throw new Error('D1 unavailable');
          return { ok: 1 };
        },
      }),
    },
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
    expect(await response.json()).toEqual({
      ok: true,
      environment: 'test',
      version: '0.1.0',
      database: 'reachable',
      authentication: 'disabled',
      publishing: 'disabled',
    });
  });

  it('fails health checks when D1 is unavailable', async () => {
    const response = await handleRequest(
      new Request('https://appbuilder.pointatx.org/api/health'),
      environment('unavailable'),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, database: 'unavailable' });
  });

  it.each(['/api/drafts', '/auth/login'])(
    'fails closed for unimplemented route %s',
    async (path) => {
      const response = await handleRequest(
        new Request(`https://appbuilder.pointatx.org${path}`),
        environment(),
      );

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        code: 'FOUNDATION_LOCKED',
        message: 'Authentication and content mutations are not configured.',
      });
    },
  );

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
