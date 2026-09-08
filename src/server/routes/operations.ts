import { Hono } from 'hono';
import { PageLimitSchema } from '../../domain/primitives';
import { requireActiveMembership } from '../authorize';
import { listAuditEvents, operationsSnapshot } from '../repositories/operations';
import type { ApiEnvironment, ApiVariables } from '../app';
import type { AuthDependencies } from './auth';

export function createOperationsRoutes(environment: ApiEnvironment, auth: AuthDependencies) {
  const routes = new Hono<{ Variables: ApiVariables }>();
  routes.get('/api/audit', async (context) => {
    await requireActiveMembership(context.req.raw, environment.DB, auth.sessions, 'audit:read');
    const limit = PageLimitSchema.parse(context.req.query('limit') ?? '25');
    return context.json(await listAuditEvents(environment.DB, limit, context.req.query('cursor')));
  });
  routes.get('/api/operations', async (context) => {
    await requireActiveMembership(
      context.req.raw,
      environment.DB,
      auth.sessions,
      'operations:read',
    );
    return context.json(await operationsSnapshot(environment.DB));
  });
  return routes;
}
