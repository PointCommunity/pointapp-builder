// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sampleManifest } from '../../../src/content/manifest';
import { validateManifestRevision } from '../../../src/content/validation';
import { externalMediaReachable } from '../../../src/content/validation';

describe('release validation', () => {
  it('reports deterministic schema, media, timing, and compatibility issues', async () => {
    const manifest = structuredClone(sampleManifest);
    manifest.screens[0].elements.push({
      id: 'feature-image',
      type: 'image',
      audienceIds: [],
      mediaId: '01993dc8-4e00-7000-8000-000000000010',
      alt: 'Welcome',
      aspect: 'wide',
    });
    manifest.campaigns.push({
      id: 'old-news',
      title: 'Old news',
      body: 'Past',
      destination: '/',
      audienceId: null,
      status: 'scheduled',
      scheduledAt: '2026-01-01T00:00:00.000Z',
    });
    manifest.settings.minimumClientContract = 2;
    const report = await validateManifestRevision(
      '01993dc8-4e00-7000-8000-000000000020',
      manifest,
      [],
      new Date('2026-09-07T00:00:00.000Z'),
    );
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'MEDIA_NOT_READY',
      'CAMPAIGN_TIME_PAST',
      'CLIENT_COMPATIBILITY',
    ]);
    expect(report.manifestDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(report.reportDigest).toMatch(/^[a-f0-9]{64}$/);
  });
  it('is ready when the complete default manifest has no errors', async () => {
    const report = await validateManifestRevision(crypto.randomUUID(), sampleManifest, []);
    expect(report).toMatchObject({ valid: true, issues: [] });
  });
  it('checks external reachability without allowing private-network targets', async () => {
    const asset = {
      id: crypto.randomUUID(),
      kind: 'video' as const,
      state: 'ready' as const,
      title: 'Message',
      filename: null,
      mimeType: 'text/uri-list',
      byteSize: 0,
      width: null,
      height: null,
      durationSeconds: null,
      altText: null,
      captionUrl: 'https://media.pointatx.org/captions.vtt',
      externalUrl: 'https://media.pointatx.org/message.mp4',
      sha256: 'a'.repeat(64),
      createdAt: new Date().toISOString(),
    };
    expect(
      await externalMediaReachable(asset, async () => new Response(null, { status: 200 })),
    ).toBe(true);
    expect(
      await externalMediaReachable(
        { ...asset, externalUrl: 'https://127.0.0.1/private' },
        async () => new Response(null, { status: 200 }),
      ),
    ).toBe(false);
    expect(
      await externalMediaReachable(asset, async () => {
        throw new Error('offline');
      }),
    ).toBe(false);
  });
});
