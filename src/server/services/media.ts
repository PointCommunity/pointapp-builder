import { digestBytes, digestCanonicalJson } from '../../content/crypto';
import {
  imageDimensions,
  imageMimeTypes,
  MAX_IMAGE_BYTES,
  type MediaInput,
} from '../../content/media';
import { appendAuditEvent } from '../audit';
import { ProblemError } from '../problems';
import { createMediaRecord, type MediaAsset } from '../repositories/media';
import type { Membership } from '../repositories/memberships';

export async function createMedia(
  database: D1Database,
  input: { metadata: MediaInput; file?: File; actor: Membership; requestId: string },
): Promise<MediaAsset> {
  const { metadata, file } = input;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  let bytes = new Uint8Array();
  let mimeType = 'text/uri-list';
  let dimensions: { width: number; height: number } | null = null;
  let sha256: string;
  if (metadata.kind === 'image') {
    if (!file) throw new ProblemError(400, 'IMAGE_FILE_REQUIRED', 'Choose an image file');
    if (!metadata.altText)
      throw new ProblemError(400, 'ALT_TEXT_REQUIRED', 'Image alt text is required');
    if (!imageMimeTypes.includes(file.type as (typeof imageMimeTypes)[number]))
      throw new ProblemError(415, 'IMAGE_TYPE_UNSUPPORTED', 'Use JPEG, PNG, WebP, or AVIF');
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES)
      throw new ProblemError(413, 'IMAGE_SIZE_INVALID', 'Images must be between 1 byte and 5 MB');
    bytes = new Uint8Array(await file.arrayBuffer());
    dimensions = imageDimensions(bytes, file.type);
    if (
      !dimensions ||
      dimensions.width < 16 ||
      dimensions.height < 16 ||
      dimensions.width > 8192 ||
      dimensions.height > 8192
    )
      throw new ProblemError(
        400,
        'IMAGE_DIMENSIONS_INVALID',
        'Image dimensions must be between 16 and 8192 pixels',
      );
    mimeType = file.type;
    sha256 = await digestBytes(bytes);
  } else {
    if (!metadata.externalUrl)
      throw new ProblemError(
        400,
        'EXTERNAL_URL_REQUIRED',
        'Audio and video require an HTTPS media URL',
      );
    if (!metadata.captionUrl)
      throw new ProblemError(
        400,
        'CAPTION_URL_REQUIRED',
        'Audio and video require an HTTPS caption or transcript URL',
      );
    sha256 = await digestCanonicalJson({
      kind: metadata.kind,
      url: metadata.externalUrl,
      captionUrl: metadata.captionUrl,
    });
  }
  if (metadata.expectedSha256 && metadata.expectedSha256 !== sha256)
    throw new ProblemError(400, 'CHECKSUM_MISMATCH', 'The uploaded media checksum does not match');
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += 256 * 1024)
    chunks.push(bytes.slice(offset, offset + 256 * 1024));
  const asset: MediaAsset = {
    id,
    kind: metadata.kind,
    state: 'ready',
    title: metadata.title,
    filename: file?.name ?? null,
    mimeType,
    byteSize: bytes.byteLength,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    durationSeconds: null,
    altText: metadata.altText ?? null,
    captionUrl: metadata.captionUrl ?? null,
    externalUrl: metadata.externalUrl ?? null,
    sha256,
    createdAt: now,
  };
  await createMediaRecord(database, asset, input.actor.githubUserId, chunks);
  await appendAuditEvent(database, {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    actor: input.actor,
    action: 'media.create',
    targetType: 'media',
    targetId: id,
    outcome: 'succeeded',
    metadata: { kind: metadata.kind, byteSize: bytes.byteLength },
  });
  return asset;
}
