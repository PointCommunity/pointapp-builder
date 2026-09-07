import { Hono } from 'hono';
import { ProblemError, problemResponse } from './problems';
import { createAuthDependencies, createAuthRoutes, type AuthDependencies } from './routes/auth';
import { createMembershipRoutes } from './routes/memberships';
import { applySecurityHeaders } from './security';

export interface ApiEnvironment {
  DB: D1Database;
  ENVIRONMENT: string;
  APP_VERSION: string;
  BUILDER_ORIGIN: string;
  AUTHENTICATION_ENABLED: string;
  PUBLISHING_ENABLED: string;
  BOOTSTRAP_OWNER_GITHUB_ID: string;
  AUTH_RATE_LIMITER?: RateLimit;
  MUTATION_RATE_LIMITER?: RateLimit;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
}

export type ApiVariables = { requestId: string };

async function databaseStatus(database: D1Database): Promise<'ok' | 'unavailable'> {
  try {
    const result = await database.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return result?.ok === 1 ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export function createServerApp(environment: ApiEnvironment, providedAuth?: AuthDependencies) {
  const app = new Hono<{ Variables: ApiVariables }>();
  const auth = providedAuth ?? createAuthDependencies(environment);

  app.use('*', async (context, next) => {
    const requestId = crypto.randomUUID();
    context.set('requestId', requestId);
    await next();
    context.res = applySecurityHeaders(context.res);
    context.res.headers.set('x-request-id', requestId);
  });

  app.get('/api/health', async (context) => {
    const database = await databaseStatus(environment.DB);
    const status = database === 'ok' ? 'ok' : 'degraded';
    return context.json(
      {
        status,
        service: 'pointapp-builder',
        environment: environment.ENVIRONMENT,
        version: environment.APP_VERSION,
        checks: {
          database,
          authentication: environment.AUTHENTICATION_ENABLED === 'true' ? 'ok' : 'unavailable',
          publishing: environment.PUBLISHING_ENABLED === 'true' ? 'ok' : 'unavailable',
        },
        time: new Date().toISOString(),
      },
      status === 'ok' ? 200 : 503,
    );
  });

  app.all('/api/health', (context) => {
    const response = problemResponse(
      new ProblemError(405, 'METHOD_NOT_ALLOWED', 'Use GET for this operation'),
      context.get('requestId'),
    );
    response.headers.set('allow', 'GET');
    return response;
  });

  app.route('/', createAuthRoutes(environment, auth));
  app.route('/', createMembershipRoutes(environment, auth));

  app.notFound(() => {
    throw new ProblemError(404, 'NOT_FOUND', 'The requested operation does not exist');
  });

  app.onError((error, context) => {
    const requestId = context.get('requestId') || crypto.randomUUID();
    if (!(error instanceof ProblemError)) {
      console.error(JSON.stringify({ event: 'unexpected_request_error', requestId }));
    }
    const response = applySecurityHeaders(problemResponse(error, requestId));
    response.headers.set('x-request-id', requestId);
    return response;
  });

  return app;
}
