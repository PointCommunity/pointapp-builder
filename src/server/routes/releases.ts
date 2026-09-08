import { Hono } from 'hono';
import { z } from 'zod';
import { requireActiveMembership } from '../authorize';
import { claimIdempotency, completeIdempotency } from '../idempotency';
import { ProblemError } from '../problems';
import { consumeRateLimit } from '../rate-limit';
import { listReleaseHistory } from '../repositories/releases';
import { readJsonMutation } from '../security';
import {
  generatedSigner,
  promoteProduction,
  publishStaging,
  rollbackProduction,
  signerFromEnvironment,
  validateRevision,
  type ReleaseSigner,
} from '../services/releases';
import type { ApiEnvironment, ApiVariables } from '../app';
import type { AuthDependencies } from './auth';

const RevisionSchema = z.strictObject({ revisionId: z.uuid() });
const PromotionSchema = z.strictObject({ stagingReleaseId: z.uuid() });
const RollbackSchema = z.strictObject({
  releaseId: z.uuid(),
  reason: z.string().trim().min(8).max(240),
});
const localSigners = new WeakMap<D1Database, Promise<ReleaseSigner>>();
function getSigner(environment: ApiEnvironment): Promise<ReleaseSigner> {
  if (
    environment.RELEASE_SIGNING_PRIVATE_JWK &&
    environment.RELEASE_SIGNING_PUBLIC_JWK &&
    environment.SIGNING_KEY_ID
  )
    return signerFromEnvironment(
      environment.SIGNING_KEY_ID,
      environment.RELEASE_SIGNING_PRIVATE_JWK,
      environment.RELEASE_SIGNING_PUBLIC_JWK,
    );
  if (environment.ENVIRONMENT !== 'production') {
    const current =
      localSigners.get(environment.DB) ??
      generatedSigner(`local-development-${crypto.randomUUID()}`);
    localSigners.set(environment.DB, current);
    return current;
  }
  throw new ProblemError(503, 'SIGNING_UNAVAILABLE', 'Release signing is unavailable');
}
async function idempotent<T>(
  environment: ApiEnvironment,
  actor: Awaited<ReturnType<typeof requireActiveMembership>>,
  operation: string,
  key: string,
  body: unknown,
  action: () => Promise<T>,
) {
  if (environment.MUTATION_RATE_LIMITER)
    await consumeRateLimit(
      environment.MUTATION_RATE_LIMITER,
      `actor:${actor.githubUserId}`,
      operation,
    );
  const input = { actorId: actor.githubUserId, operation, key, body };
  const claim = await claimIdempotency(environment.DB, input);
  if (claim.kind === 'replay') return claim.body as T;
  const result = await action();
  await completeIdempotency(environment.DB, input, 201, result);
  return result;
}
export function createReleaseRoutes(environment: ApiEnvironment, auth: AuthDependencies) {
  const routes = new Hono<{ Variables: ApiVariables }>();
  routes.post('/api/releases/validate', async (context) => {
    await requireActiveMembership(context.req.raw, environment.DB, auth.sessions, 'draft:read');
    const body = RevisionSchema.parse(
      await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN),
    );
    return context.json(await validateRevision(environment.DB, body.revisionId));
  });
  routes.get('/api/releases', async (context) => {
    await requireActiveMembership(context.req.raw, environment.DB, auth.sessions, 'draft:read');
    return context.json({ items: await listReleaseHistory(environment.DB), nextCursor: null });
  });
  routes.post('/api/releases/staging', async (context) => {
    const actor = await requireActiveMembership(
      context.req.raw,
      environment.DB,
      auth.sessions,
      'staging:publish',
    );
    const body = RevisionSchema.parse(
      await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN),
    );
    return context.json(
      await idempotent(
        environment,
        actor,
        'release:staging',
        context.req.header('idempotency-key') ?? '',
        body,
        async () =>
          publishStaging(environment.DB, {
            ...body,
            actor,
            requestId: context.get('requestId'),
            signer: await getSigner(environment),
          }),
      ),
      201,
    );
  });
  routes.post('/api/releases/production/promotions', async (context) => {
    const actor = await requireActiveMembership(
      context.req.raw,
      environment.DB,
      auth.sessions,
      'production:promote',
    );
    const body = PromotionSchema.parse(
      await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN),
    );
    return context.json(
      await idempotent(
        environment,
        actor,
        'release:promote',
        context.req.header('idempotency-key') ?? '',
        body,
        () =>
          promoteProduction(environment.DB, {
            ...body,
            actor,
            requestId: context.get('requestId'),
          }),
      ),
      201,
    );
  });
  routes.post('/api/releases/production/rollbacks', async (context) => {
    const actor = await requireActiveMembership(
      context.req.raw,
      environment.DB,
      auth.sessions,
      'production:rollback',
    );
    const body = RollbackSchema.parse(
      await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN),
    );
    return context.json(
      await idempotent(
        environment,
        actor,
        'release:rollback',
        context.req.header('idempotency-key') ?? '',
        body,
        () =>
          rollbackProduction(environment.DB, {
            ...body,
            actor,
            requestId: context.get('requestId'),
          }),
      ),
      201,
    );
  });
  return routes;
}
