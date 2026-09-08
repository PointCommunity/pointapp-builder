import { Hono } from 'hono';
import { referencedMediaIds } from '../../content/validation';
import { ProblemError } from '../problems';
import { readMediaBytes, requireMedia } from '../repositories/media';
import { publicEnvelope } from '../repositories/releases';
import type { ApiEnvironment, ApiVariables } from '../app';

export function createPublicContentRoutes(environment: ApiEnvironment) {
  const routes = new Hono<{ Variables: ApiVariables }>();
  routes.get('/content/v1/channels/production', async (context) => {
    const envelope = await publicEnvelope(environment.DB);
    if (!envelope)
      throw new ProblemError(
        404,
        'PRODUCTION_NOT_PUBLISHED',
        'PointApp Production content is not published',
      );
    const etag = `"sha256-${envelope.manifestDigest}"`;
    if (context.req.header('if-none-match') === etag)
      return new Response(null, {
        status: 304,
        headers: { etag, 'cache-control': 'public, max-age=0, must-revalidate' },
      });
    return context.json(envelope, 200, {
      etag,
      'cache-control': 'public, max-age=0, must-revalidate',
    });
  });
  routes.get('/content/v1/keys/:keyId', async (context) => {
    const row = await environment.DB.prepare('SELECT public_jwk FROM signing_keys WHERE key_id = ?')
      .bind(context.req.param('keyId'))
      .first<{ public_jwk: string }>();
    if (!row)
      throw new ProblemError(404, 'SIGNING_KEY_NOT_FOUND', 'The signing key does not exist');
    return new Response(row.public_jwk, {
      headers: {
        'content-type': 'application/jwk+json',
        'cache-control': 'public, max-age=86400, immutable',
      },
    });
  });
  routes.get('/content/v1/media/:mediaId', async (context) => {
    const envelope = await publicEnvelope(environment.DB);
    const mediaId = context.req.param('mediaId');
    if (!envelope || !referencedMediaIds(envelope.manifest).has(mediaId))
      throw new ProblemError(
        404,
        'MEDIA_NOT_FOUND',
        'The media asset is not in current Production content',
      );
    const asset = await requireMedia(environment.DB, mediaId);
    if (asset.state !== 'ready')
      throw new ProblemError(404, 'MEDIA_NOT_FOUND', 'The media asset is not available');
    if (asset.externalUrl) return Response.redirect(asset.externalUrl, 302);
    const bytes = await readMediaBytes(environment.DB, mediaId);
    return new Response(Uint8Array.from(bytes).buffer, {
      headers: {
        'content-type': asset.mimeType,
        etag: `"sha256-${asset.sha256}"`,
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  });
  return routes;
}
