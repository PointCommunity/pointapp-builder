import { Hono } from 'hono';
import { z } from 'zod';
import { MediaInputSchema, MAX_IMAGE_BYTES } from '../../content/media';
import { requireActiveMembership } from '../authorize';
import { appendAuditEvent } from '../audit';
import { claimIdempotency, completeIdempotency } from '../idempotency';
import { ProblemError } from '../problems';
import { consumeRateLimit } from '../rate-limit';
import { listMedia, readMediaBytes, requireMedia, updateMediaState } from '../repositories/media';
import { readJsonMutation, requireMutationHeaders } from '../security';
import { createMedia } from '../services/media';
import type { ApiEnvironment, ApiVariables } from '../app';
import type { AuthDependencies } from './auth';

export function createMediaRoutes(environment: ApiEnvironment, auth: AuthDependencies) {
  const routes = new Hono<{ Variables: ApiVariables }>();
  routes.get('/api/media', async (context) => {
    await requireActiveMembership(context.req.raw, environment.DB, auth.sessions, 'draft:read');
    return context.json({ items: await listMedia(environment.DB), nextCursor: null });
  });
  routes.post('/api/media', async (context) => {
    const actor = await requireActiveMembership(
      context.req.raw,
      environment.DB,
      auth.sessions,
      'asset:manage',
    );
    requireMutationHeaders(
      context.req.raw,
      environment.BUILDER_ORIGIN,
      ['multipart/form-data'],
      MAX_IMAGE_BYTES + 64 * 1024,
    );
    if (environment.MUTATION_RATE_LIMITER)
      await consumeRateLimit(
        environment.MUTATION_RATE_LIMITER,
        `actor:${actor.githubUserId}`,
        'media:create',
      );
    const form = await context.req.raw.formData();
    const rawMetadata = form.get('metadata');
    if (typeof rawMetadata !== 'string' || rawMetadata.length > 4096)
      throw new ProblemError(400, 'MEDIA_METADATA_REQUIRED', 'Valid media metadata is required');
    let decoded: unknown;
    try {
      decoded = JSON.parse(rawMetadata);
    } catch {
      throw new ProblemError(400, 'MEDIA_METADATA_INVALID', 'Media metadata is not valid JSON');
    }
    const metadata = MediaInputSchema.parse(decoded);
    const candidateFile = form.get('file');
    const file = candidateFile instanceof File ? candidateFile : undefined;
    const idempotency = {
      actorId: actor.githubUserId,
      operation: 'media:create',
      key: context.req.header('idempotency-key') ?? '',
      body: { metadata, file: file ? { name: file.name, size: file.size, type: file.type } : null },
    };
    const claim = await claimIdempotency(environment.DB, idempotency);
    if (claim.kind === 'replay') return context.json(claim.body, claim.status as 201);
    const asset = await createMedia(environment.DB, {
      metadata,
      file,
      actor,
      requestId: context.get('requestId'),
    });
    await completeIdempotency(environment.DB, idempotency, 201, asset);
    return context.json(asset, 201);
  });
  routes.get('/api/media/:mediaId', async (context) => {
    await requireActiveMembership(context.req.raw, environment.DB, auth.sessions, 'draft:read');
    const asset = await requireMedia(environment.DB, context.req.param('mediaId'));
    if (asset.externalUrl) return context.json(asset);
    const bytes = await readMediaBytes(environment.DB, asset.id);
    return new Response(Uint8Array.from(bytes).buffer, {
      headers: {
        'content-type': asset.mimeType,
        'content-length': String(bytes.byteLength),
        etag: `"sha256-${asset.sha256}"`,
      },
    });
  });
  routes.patch('/api/media/:mediaId', async (context) => {
    const actor = await requireActiveMembership(
      context.req.raw,
      environment.DB,
      auth.sessions,
      'asset:manage',
    );
    const body = z
      .strictObject({ state: z.enum(['ready', 'archived']) })
      .parse(await readJsonMutation(context.req.raw, environment.BUILDER_ORIGIN));
    const id = context.req.param('mediaId');
    const idempotency = {
      actorId: actor.githubUserId,
      operation: `media:update:${id}`,
      key: context.req.header('idempotency-key') ?? '',
      body,
    };
    const claim = await claimIdempotency(environment.DB, idempotency);
    if (claim.kind === 'replay') return context.json(claim.body, 200);
    const asset = await updateMediaState(environment.DB, id, body.state, actor.githubUserId);
    await appendAuditEvent(environment.DB, {
      id: crypto.randomUUID(),
      requestId: context.get('requestId'),
      actor,
      action: body.state === 'archived' ? 'media.archive' : 'media.recover',
      targetType: 'media',
      targetId: id,
      outcome: 'succeeded',
    });
    await completeIdempotency(environment.DB, idempotency, 200, asset);
    return context.json(asset);
  });
  return routes;
}
