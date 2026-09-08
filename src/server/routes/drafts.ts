import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { AppManifestSchema } from '../../content/manifest';
import { requireActiveMembership } from '../authorize';
import { claimIdempotency, completeIdempotency } from '../idempotency';
import { consumeRateLimit } from '../rate-limit';
import { listDrafts, listRevisions, requireDraft } from '../repositories/drafts';
import { readJsonMutation } from '../security';
import { changeDraft, createDraft, saveDraftRevision } from '../services/drafts';
import type { ApiEnvironment, ApiVariables } from '../app';
import type { AuthDependencies } from './auth';

const CreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  duplicateRevisionId: z.uuid().optional(),
});
const UpdateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(80).optional(),
  state: z.enum(['active', 'archived']).optional(),
});
const SaveSchema = z.strictObject({
  expectedParentRevisionId: z.uuid(),
  label: z.string().trim().min(1).max(120),
  manifest: AppManifestSchema,
});

async function mutate<T>(
  environment: ApiEnvironment,
  context: Context<{ Variables: ApiVariables }>,
  auth: AuthDependencies,
  operation: string,
  body: unknown,
  responseStatus: 200 | 201,
  action: (actor: Awaited<ReturnType<typeof requireActiveMembership>>) => Promise<T>,
): Promise<Response> {
  const actor = await requireActiveMembership(
    context.req.raw,
    environment.DB,
    auth.sessions,
    'draft:write',
  );
  if (environment.MUTATION_RATE_LIMITER)
    await consumeRateLimit(
      environment.MUTATION_RATE_LIMITER,
      `actor:${actor.githubUserId}`,
      operation,
    );
  const input = {
    actorId: actor.githubUserId,
    operation,
    key: context.req.header('idempotency-key') ?? '',
    body,
  };
  const claim = await claimIdempotency(environment.DB, input);
  if (claim.kind === 'replay') return context.json(claim.body, claim.status as 200 | 201);
  const result = await action(actor);
  await completeIdempotency(environment.DB, input, responseStatus, result);
  return context.json(result, responseStatus);
}

export function createDraftRoutes(environment: ApiEnvironment, auth: AuthDependencies) {
  const routes = new Hono<{ Variables: ApiVariables }>();
  routes.get('/api/drafts', async (context) => {
    await requireActiveMembership(context.req.raw, environment.DB, auth.sessions, 'draft:read');
    return context.json({
      items: await listDrafts(environment.DB, context.req.query('state') === 'all'),
      nextCursor: null,
    });
  });
  routes.post('/api/drafts', async (context) => {
    const body = CreateSchema.parse(
      await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN),
    );
    return mutate(environment, context, auth, 'draft:create', body, 201, (actor) =>
      createDraft(environment.DB, { ...body, actor, requestId: context.get('requestId') }),
    );
  });
  routes.get('/api/drafts/:draftId', async (context) => {
    await requireActiveMembership(context.req.raw, environment.DB, auth.sessions, 'draft:read');
    return context.json(await requireDraft(environment.DB, context.req.param('draftId')));
  });
  routes.patch('/api/drafts/:draftId', async (context) => {
    const body = UpdateSchema.parse(
      await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN),
    );
    const draftId = context.req.param('draftId');
    return mutate(environment, context, auth, `draft:update:${draftId}`, body, 200, (actor) =>
      changeDraft(environment.DB, { ...body, draftId, actor, requestId: context.get('requestId') }),
    );
  });
  routes.get('/api/drafts/:draftId/revisions', async (context) => {
    await requireActiveMembership(context.req.raw, environment.DB, auth.sessions, 'draft:read');
    await requireDraft(environment.DB, context.req.param('draftId'));
    return context.json({
      items: await listRevisions(environment.DB, context.req.param('draftId')),
      nextCursor: null,
    });
  });
  routes.post('/api/drafts/:draftId/revisions', async (context) => {
    const body = SaveSchema.parse(
      await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN),
    );
    const draftId = context.req.param('draftId');
    return mutate(environment, context, auth, `draft:save:${draftId}`, body, 201, (actor) =>
      saveDraftRevision(environment.DB, {
        ...body,
        draftId,
        actor,
        requestId: context.get('requestId'),
      }),
    );
  });
  return routes;
}
