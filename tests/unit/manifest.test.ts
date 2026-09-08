import { describe, expect, it } from 'vitest';
import {
  AppManifestSchema,
  createElement,
  elementTypes,
  sampleManifest,
} from '../../src/content/manifest';

describe('PointApp content manifest', () => {
  it('accepts the complete checked-in version 1 fixture', () =>
    expect(AppManifestSchema.parse(sampleManifest)).toEqual(sampleManifest));
  it('has bounded defaults for every supported element type', () => {
    expect(elementTypes).toHaveLength(12);
    for (const [index, type] of elementTypes.entries()) {
      const candidate = structuredClone(sampleManifest);
      candidate.screens[0].elements = [createElement(type, `element-${index}`)];
      expect(() => AppManifestSchema.parse(candidate), type).not.toThrow();
    }
  });
  it('rejects navigation that targets a missing or hidden screen', () => {
    const missing = structuredClone(sampleManifest);
    missing.navigation[0].screenId = 'missing';
    expect(() => AppManifestSchema.parse(missing)).toThrow(/existing visible screen/);
    const hidden = structuredClone(sampleManifest);
    hidden.screens[0].visible = false;
    expect(() => AppManifestSchema.parse(hidden)).toThrow(/existing visible screen/);
  });
  it('rejects globally duplicate identifiers', () => {
    const candidate = structuredClone(sampleManifest);
    candidate.screens[0].elements.push(candidate.screens[0].elements[0]);
    expect(() => AppManifestSchema.parse(candidate)).toThrow(/globally unique/);
  });
  it('rejects unknown audiences and executable fields', () => {
    const audience = structuredClone(sampleManifest);
    audience.screens[0].audienceIds = ['missing'];
    expect(() => AppManifestSchema.parse(audience)).toThrow(/Unknown audience/);
    expect(() => AppManifestSchema.parse({ ...sampleManifest, executable: 'alert(1)' })).toThrow();
  });
  it('bounds links, campaign timing, navigation counts, and colors', () => {
    const unsafe = structuredClone(sampleManifest);
    unsafe.settings.supportUrl = 'http://pointatx.org';
    expect(() => AppManifestSchema.parse(unsafe)).toThrow();
    const campaign = structuredClone(sampleManifest);
    campaign.campaigns.push({
      id: 'notice',
      title: 'News',
      body: 'Today',
      destination: '/',
      audienceId: null,
      status: 'scheduled',
      scheduledAt: null,
    });
    expect(() => AppManifestSchema.parse(campaign)).toThrow(/require a time/);
    const nav = structuredClone(sampleManifest);
    nav.navigation = [nav.navigation[0]];
    expect(() => AppManifestSchema.parse(nav)).toThrow();
    const theme = structuredClone(sampleManifest);
    theme.theme.accent = 'red';
    expect(() => AppManifestSchema.parse(theme)).toThrow();
  });
});
