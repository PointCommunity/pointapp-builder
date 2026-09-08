import { Hono } from 'hono';
import { ProblemError, problemResponse, toProblemError } from './problems';
import { createAuthDependencies, createAuthRoutes, type AuthDependencies } from './routes/auth';
import { createMembershipRoutes } from './routes/memberships';
import { createDraftRoutes } from './routes/drafts';
import { createMediaRoutes } from './routes/media';
import { createReleaseRoutes } from './routes/releases';
import { createPublicContentRoutes } from './routes/public-content';
import { createOperationsRoutes } from './routes/operations';
import { applySecurityHeaders } from './security';
import { readHealth } from './services/operations';
import { resolveSession } from './authorize';
import { appendAuditEvent } from './audit';

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
  SIGNING_KEY_ID?: string;
  RELEASE_SIGNING_PRIVATE_JWK?: string;
  RELEASE_SIGNING_PUBLIC_JWK?: string;
}

export type ApiVariables = { requestId: string };

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
    const health = await readHealth(environment);
    return context.json(health, health.status === 'ok' ? 200 : 503);
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
  app.route('/', createDraftRoutes(environment, auth));
  app.route('/', createMediaRoutes(environment, auth));
  app.route('/', createReleaseRoutes(environment, auth));
  app.route('/', createPublicContentRoutes(environment));
  app.route('/', createOperationsRoutes(environment, auth));

  app.notFound(() => {
    throw new ProblemError(404, 'NOT_FOUND', 'The requested operation does not exist');
  });

  app.onError(async (error, context) => {
    const requestId = context.get('requestId') || crypto.randomUUID();
    const problem = toProblemError(error);
    if (problem.status === 500) {
      console.error(JSON.stringify({ event: 'unexpected_request_error', requestId }));
      if (environment.ENVIRONMENT !== 'production') console.error(error);
    }
    const path = new URL(context.req.url).pathname;
    const mutation =
      !['GET', 'HEAD', 'OPTIONS'].includes(context.req.method) || path.startsWith('/auth/');
    if (mutation) {
      try {
        const session = await resolveSession(context.req.raw, environment.DB, auth.sessions);
        const family = path.startsWith('/auth/')
          ? 'auth'
          : path.startsWith('/api/memberships')
            ? 'membership'
            : path.startsWith('/api/drafts')
              ? 'draft'
              : path.startsWith('/api/media')
                ? 'media'
                : path.startsWith('/api/releases')
                  ? 'release'
                  : 'security';
        await appendAuditEvent(environment.DB, {
          id: crypto.randomUUID(),
          requestId,
          actor: session.membership ?? undefined,
          action: `${family}.request`,
          targetType: family,
          outcome: problem.status === 401 || problem.status === 403 ? 'denied' : 'failed',
          reason: problem.code,
        });
      } catch {
        // Audit failure must not replace the original safe API problem.
      }
    }
    const response = applySecurityHeaders(problemResponse(problem, requestId));
    response.headers.set('x-request-id', requestId);
    return response;
  });

  return app;
}
