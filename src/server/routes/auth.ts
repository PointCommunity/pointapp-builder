import { Hono } from 'hono';
import { appendAuditEvent } from '../audit';
import { resolveSession } from '../authorize';
import {
  GitHubApiGateway,
  GitHubAuthenticator,
  GitHubSessionCodec,
  type GitHubIdentity,
} from '../auth';
import { ProblemError } from '../problems';
import { consumeRateLimit } from '../rate-limit';
import { registerIdentity } from '../repositories/memberships';
import type { ApiEnvironment, ApiVariables } from '../app';

export interface AuthDependencies {
  sessions?: GitHubSessionCodec;
  authenticator?: GitHubAuthenticator;
}

export function createAuthDependencies(environment: ApiEnvironment): AuthDependencies {
  if (!environment.SESSION_SECRET) return {};
  const sessions = new GitHubSessionCodec(environment.SESSION_SECRET);
  if (!environment.GITHUB_CLIENT_ID || !environment.GITHUB_CLIENT_SECRET) return { sessions };
  const config = {
    builderOrigin: environment.BUILDER_ORIGIN,
    clientId: environment.GITHUB_CLIENT_ID,
    clientSecret: environment.GITHUB_CLIENT_SECRET,
    sessionSecret: environment.SESSION_SECRET,
  };
  return {
    sessions,
    authenticator: new GitHubAuthenticator(config, new GitHubApiGateway(config), sessions),
  };
}

function loopback(url: URL): boolean {
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
}

export function createAuthRoutes(environment: ApiEnvironment, dependencies: AuthDependencies) {
  const routes = new Hono<{ Variables: ApiVariables }>();

  routes.get('/api/session', async (context) => {
    const session = await resolveSession(context.req.raw, environment.DB, dependencies.sessions);
    return context.json({
      state: session.state,
      membership: session.membership,
      capabilities: session.capabilities,
    });
  });

  routes.get('/auth/login', async (context) => {
    if (!dependencies.authenticator) {
      throw new ProblemError(503, 'AUTH_UNAVAILABLE', 'GitHub sign-in is not configured');
    }
    if (environment.AUTH_RATE_LIMITER) {
      await consumeRateLimit(
        environment.AUTH_RATE_LIMITER,
        `ip:${context.req.header('cf-connecting-ip') ?? 'unknown'}`,
        'auth:login',
      );
    }
    return dependencies.authenticator.beginLogin(context.req.raw);
  });

  routes.get('/auth/callback', async (context) => {
    if (!dependencies.authenticator) {
      throw new ProblemError(503, 'AUTH_UNAVAILABLE', 'GitHub sign-in is not configured');
    }
    if (environment.AUTH_RATE_LIMITER) {
      await consumeRateLimit(
        environment.AUTH_RATE_LIMITER,
        `ip:${context.req.header('cf-connecting-ip') ?? 'unknown'}`,
        'auth:callback',
      );
    }
    const completed = await dependencies.authenticator.completeLogin(context.req.raw);
    const membership = await registerIdentity(
      environment.DB,
      completed.identity,
      environment.BOOTSTRAP_OWNER_GITHUB_ID,
    );
    await appendAuditEvent(environment.DB, {
      id: crypto.randomUUID(),
      requestId: context.get('requestId'),
      actor: membership,
      action: 'auth.login',
      targetType: 'session',
      targetId: membership.githubUserId,
      outcome: 'succeeded',
      metadata: { state: membership.status, role: membership.role },
    });
    return completed.response;
  });

  routes.post('/auth/logout', async (context) => {
    if (
      context.req.header('origin') !== environment.BUILDER_ORIGIN ||
      context.req.header('sec-fetch-site') !== 'same-origin'
    ) {
      throw new ProblemError(403, 'ORIGIN_DENIED', 'The request origin is not allowed');
    }
    if (!dependencies.sessions)
      throw new ProblemError(503, 'AUTH_UNAVAILABLE', 'Sign-out is unavailable');
    const session = await resolveSession(context.req.raw, environment.DB, dependencies.sessions);
    if (session.membership)
      await appendAuditEvent(environment.DB, {
        id: crypto.randomUUID(),
        requestId: context.get('requestId'),
        actor: session.membership,
        action: 'auth.logout',
        targetType: 'session',
        targetId: session.membership.githubUserId,
        outcome: 'succeeded',
      });
    return new Response(null, {
      status: 204,
      headers: {
        'set-cookie': dependencies.sessions.clearSessionCookie(
          new URL(environment.BUILDER_ORIGIN).protocol === 'https:',
        ),
      },
    });
  });

  routes.get('/auth/dev', async (context) => {
    const url = new URL(context.req.url);
    if (environment.ENVIRONMENT !== 'local' || !loopback(url) || !dependencies.sessions) {
      throw new ProblemError(404, 'NOT_FOUND', 'The requested operation does not exist');
    }
    const githubUserId = url.searchParams.get('githubUserId') ?? '';
    const login = url.searchParams.get('login') ?? '';
    if (!/^[1-9][0-9]{0,19}$/.test(githubUserId) || !/^[A-Za-z0-9-]{1,39}$/.test(login)) {
      throw new ProblemError(400, 'INVALID_DEV_IDENTITY', 'Use a valid local fixture identity');
    }
    const identity: GitHubIdentity = {
      id: Number(githubUserId),
      login,
      displayName: login,
      avatarUrl: null,
    };
    const membership = await registerIdentity(
      environment.DB,
      identity,
      environment.BOOTSTRAP_OWNER_GITHUB_ID,
    );
    await appendAuditEvent(environment.DB, {
      id: crypto.randomUUID(),
      requestId: context.get('requestId'),
      actor: membership,
      action: 'auth.login-local',
      targetType: 'session',
      targetId: membership.githubUserId,
      outcome: 'succeeded',
      metadata: { state: membership.status, role: membership.role },
    });
    return dependencies.sessions.sessionResponse(identity, `${environment.BUILDER_ORIGIN}/`);
  });

  return routes;
}
