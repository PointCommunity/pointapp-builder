import { describe, expect, it } from 'vitest';
import { AppManifestSchema, sampleManifest } from '../../src/content/manifest';

describe('PointApp content manifest', () => {
  it('accepts the checked-in version 1 fixture', () => {
    expect(AppManifestSchema.parse(sampleManifest)).toEqual(sampleManifest);
  });

  it('rejects navigation that targets a missing screen', () => {
    const candidate = structuredClone(sampleManifest);
    candidate.navigation[0].screenId = 'missing';
    expect(() => AppManifestSchema.parse(candidate)).toThrow(/existing screen/);
  });

  it('rejects duplicate element identifiers across screens', () => {
    const candidate = structuredClone(sampleManifest);
    candidate.screens[0].elements.push(candidate.screens[0].elements[0]);
    expect(() => AppManifestSchema.parse(candidate)).toThrow(/unique/);
  });

  it('rejects unknown element properties so mobile clients see a stable contract', () => {
    const candidate = structuredClone(sampleManifest) as unknown as Record<string, unknown>;
    const screens = candidate.screens as Array<{ elements: Array<Record<string, unknown>> }>;
    screens[0].elements[0].executable = 'alert(1)';
    expect(() => AppManifestSchema.parse(candidate)).toThrow();
  });
});
