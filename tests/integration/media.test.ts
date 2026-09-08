// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { registerIdentity } from '../../src/server/repositories/memberships';
import { readMediaBytes } from '../../src/server/repositories/media';
import { createMedia } from '../../src/server/services/media';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

function png(width = 16, height = 16) {
  const bytes = new Uint8Array(32);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
function supportedImage(type: 'image/jpeg' | 'image/webp' | 'image/avif') {
  const bytes = new Uint8Array(40);
  const view = new DataView(bytes.buffer);
  if (type === 'image/jpeg') {
    bytes.set([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 16, 0, 16]);
  } else if (type === 'image/webp') {
    bytes.set(new TextEncoder().encode('RIFF'), 0);
    bytes.set(new TextEncoder().encode('WEBPVP8X'), 8);
    bytes[24] = 15;
    bytes[27] = 15;
  } else {
    bytes.set(new TextEncoder().encode('ftypavif'), 4);
    bytes.set(new TextEncoder().encode('ispe'), 16);
    view.setUint32(20, 16);
    view.setUint32(24, 16);
  }
  return bytes;
}
async function fixture() {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  const actor = await registerIdentity(
    db,
    { id: 1_202_831, login: 'brimdor', displayName: null, avatarUrl: null },
    '1202831',
  );
  return { db, actor };
}
describe('media library', () => {
  it('stores a bounded image in chunks with checksum and accessibility metadata', async () => {
    const { db, actor } = await fixture();
    const bytes = png();
    const asset = await createMedia(db, {
      metadata: { kind: 'image', title: 'Welcome', altText: 'People gathering' },
      file: new File([bytes], 'welcome.png', { type: 'image/png' }),
      actor,
      requestId: crypto.randomUUID(),
    });
    expect(asset).toMatchObject({ kind: 'image', width: 16, height: 16, byteSize: 32 });
    expect(await readMediaBytes(db, asset.id)).toEqual(bytes);
  });
  it('rejects missing alt text, unsupported types, dimensions, and checksums', async () => {
    const { db, actor } = await fixture();
    const create = (metadata: Record<string, unknown>, file: File) =>
      createMedia(db, { metadata: metadata as never, file, actor, requestId: crypto.randomUUID() });
    await expect(
      create({ kind: 'image', title: 'No alt' }, new File([png()], 'a.png', { type: 'image/png' })),
    ).rejects.toMatchObject({ code: 'ALT_TEXT_REQUIRED' });
    await expect(
      create(
        { kind: 'image', title: 'Bad', altText: 'Bad' },
        new File(['bad'], 'a.gif', { type: 'image/gif' }),
      ),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      create(
        { kind: 'image', title: 'Tiny', altText: 'Tiny' },
        new File([png(1, 1)], 'a.png', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_DIMENSIONS_INVALID' });
    await expect(
      create(
        { kind: 'image', title: 'Hash', altText: 'Hash', expectedSha256: 'a'.repeat(64) },
        new File([png()], 'a.png', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' });
    await expect(
      create(
        { kind: 'image', title: 'Spoofed', altText: 'Spoofed' },
        new File([new Uint8Array(32)], 'fake.png', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({ code: 'IMAGE_DIMENSIONS_INVALID' });
  });
  it.each(['image/jpeg', 'image/webp', 'image/avif'] as const)(
    'accepts valid %s image headers',
    async (type) => {
      const { db, actor } = await fixture();
      const asset = await createMedia(db, {
        metadata: { kind: 'image', title: type, altText: 'Accessible image' },
        file: new File([supportedImage(type)], `image.${type.split('/')[1]}`, { type }),
        actor,
        requestId: crypto.randomUUID(),
      });
      expect(asset).toMatchObject({ mimeType: type, width: 16, height: 16 });
    },
  );
  it('requires HTTPS source and captions for external audio/video metadata', async () => {
    const { db, actor } = await fixture();
    await expect(
      createMedia(db, {
        metadata: {
          kind: 'video',
          title: 'Message',
          externalUrl: 'https://media.pointatx.org/message.mp4',
        },
        actor,
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'CAPTION_URL_REQUIRED' });
    const asset = await createMedia(db, {
      metadata: {
        kind: 'audio',
        title: 'Podcast',
        externalUrl: 'https://media.pointatx.org/podcast.mp3',
        captionUrl: 'https://media.pointatx.org/podcast.txt',
      },
      actor,
      requestId: crypto.randomUUID(),
    });
    expect(asset.externalUrl).toMatch(/^https:/);
  });
});
