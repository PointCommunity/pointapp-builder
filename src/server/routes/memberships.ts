import { Hono } from 'hono';
import { z } from 'zod';
import { membershipStatuses, roles } from '../../domain/access';
import { PageLimitSchema } from '../../domain/primitives';
import { requireActiveMembership } from '../authorize';
import { claimIdempotency, completeIdempotency } from '../idempotency';
import { ProblemError } from '../problems';
import { consumeRateLimit } from '../rate-limit';
import { listMemberships, requireMembership } from '../repositories/memberships';
import { readJsonMutation } from '../security';
import { updateMembership } from '../services/memberships';
import type { ApiEnvironment, ApiVariables } from '../app';
import type { AuthDependencies } from './auth';

const UpdateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  role: z.enum(roles).optional(),
  status: z.enum(membershipStatuses).optional(),
  reason: z.string().trim().min(3).max(240),
});

export function createMembershipRoutes(environment: ApiEnvironment, auth: AuthDependencies) {
  const routes = new Hono<{ Variables: ApiVariables }>();

  routes.get('/api/memberships', async (context) => {
    const actor = await requireActiveMembership(
      context.req.raw,
      environment.DB,
      auth.sessions,
      'access:read',
    );
    const limit = PageLimitSchema.parse(context.req.query('limit') ?? '25');
    return context.json(
      await listMemberships(environment.DB, actor, limit, context.req.query('cursor')),
    );
  });

  routes.patch('/api/memberships/:githubUserId', async (context) => {
    const actor = await requireActiveMembership(
      context.req.raw,
      environment.DB,
      auth.sessions,
      'access:manage-basic',
    );
    if (environment.MUTATION_RATE_LIMITER) {
      await consumeRateLimit(
        environment.MUTATION_RATE_LIMITER,
        `actor:${actor.githubUserId}`,
        'membership:update',
      );
    }
    const body = UpdateSchema.parse(
      await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN),
    );
    const targetId = context.req.param('githubUserId');
    if (!/^[1-9][0-9]{0,19}$/.test(targetId)) {
      throw new ProblemError(400, 'INVALID_GITHUB_USER_ID', 'The GitHub user ID is invalid');
    }
    const target = await requireMembership(environment.DB, targetId);
    const key = context.req.header('idempotency-key') ?? '';
    const idempotency = {
      actorId: actor.githubUserId,
      operation: `membership:update:${targetId}`,
      key,
      body,
    };
    const claim = await claimIdempotency(environment.DB, idempotency);
    if (claim.kind === 'replay') return context.json(claim.body, claim.status as 200);
    const updated = await updateMembership(environment.DB, {
      actor,
      targetGithubUserId: targetId,
      expectedVersion: body.expectedVersion,
      role: body.role ?? target.role,
      status: body.status ?? target.status,
      reason: body.reason,
      requestId: context.get('requestId'),
    });
    await completeIdempotency(environment.DB, idempotency, 200, updated);
    return context.json(updated);
  });

  return routes;
}
