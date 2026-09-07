interface DatabaseStatement {
  first(): Promise<{ ok?: unknown } | null>;
}

interface DatabaseBinding {
  prepare(query: string): DatabaseStatement;
}

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

export interface RuntimeEnv {
  DB: DatabaseBinding;
  ASSETS: AssetBinding;
  ENVIRONMENT: string;
  APP_VERSION: string;
  BUILDER_ORIGIN: string;
  AUTHENTICATION_ENABLED: string;
  PUBLISHING_ENABLED: string;
}

const responseHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers: { ...responseHeaders, ...headers } });
}

async function databaseIsReachable(database: DatabaseBinding): Promise<boolean> {
  try {
    const result = await database.prepare('SELECT 1 AS ok').first();
    return result?.ok === 1;
  } catch {
    return false;
  }
}

export async function handleRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);

  const builderHostname = new URL(env.BUILDER_ORIGIN).hostname;
  if (url.protocol === 'http:' && url.hostname === builderHostname) {
    url.protocol = 'https:';
    return Response.redirect(url, 308);
  }

  if (url.pathname === '/api/health') {
    if (request.method !== 'GET')
      return json({ code: 'METHOD_NOT_ALLOWED' }, 405, { allow: 'GET' });
    const reachable = await databaseIsReachable(env.DB);
    return json(
      {
        ok: reachable,
        environment: env.ENVIRONMENT,
        version: env.APP_VERSION,
        database: reachable ? 'reachable' : 'unavailable',
        authentication: env.AUTHENTICATION_ENABLED === 'true' ? 'enabled' : 'disabled',
        publishing: env.PUBLISHING_ENABLED === 'true' ? 'enabled' : 'disabled',
      },
      reachable ? 200 : 503,
    );
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return json(
      {
        code: 'FOUNDATION_LOCKED',
        message: 'Authentication and content mutations are not configured.',
      },
      503,
    );
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleRequest,
};
