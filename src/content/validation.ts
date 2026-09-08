import { AppManifestSchema, type AppManifest } from './manifest';
import { digestCanonicalJson } from './crypto';
import type { MediaAsset } from '../server/repositories/media';

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: 'error' | 'warning';
}
export interface ValidationReport {
  valid: boolean;
  revisionId: string;
  manifestDigest: string;
  reportDigest: string;
  issues: ValidationIssue[];
}

function publicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host === '::1') return false;
    if (/^(127\.|10\.|169\.254\.|192\.168\.)/.test(host)) return false;
    const match = /^172\.(\d+)\./.exec(host);
    return !match || Number(match[1]) < 16 || Number(match[1]) > 31;
  } catch {
    return false;
  }
}

export async function externalMediaReachable(
  asset: MediaAsset,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  for (const url of [asset.externalUrl, asset.captionUrl].filter(Boolean) as string[]) {
    if (!publicHttpsUrl(url)) return false;
    try {
      const response = await fetcher(url, {
        method: 'HEAD',
        redirect: 'error',
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) continue;
      if (response.status !== 405 && response.status !== 501) return false;
      const fallback = await fetcher(url, {
        method: 'GET',
        headers: { range: 'bytes=0-0' },
        redirect: 'error',
        signal: AbortSignal.timeout(3_000),
      });
      if (!fallback.ok && fallback.status !== 206) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function referencedMediaIds(manifest: AppManifest): Set<string> {
  const ids = new Set<string>();
  if (manifest.theme.logoMediaId) ids.add(manifest.theme.logoMediaId);
  for (const element of manifest.screens.flatMap((screen) => screen.elements)) {
    if ('mediaId' in element) ids.add(element.mediaId);
    if (element.type === 'hero' && element.imageMediaId) ids.add(element.imageMediaId);
    if (element.type === 'card-list')
      for (const card of element.cards) if (card.imageMediaId) ids.add(card.imageMediaId);
  }
  return ids;
}

export async function validateManifestRevision(
  revisionId: string,
  manifestValue: unknown,
  assets: readonly MediaAsset[],
  now = new Date(),
  reachability: (asset: MediaAsset) => Promise<boolean> = externalMediaReachable,
): Promise<ValidationReport> {
  const parsed = AppManifestSchema.safeParse(manifestValue);
  const issues: ValidationIssue[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      issues.push({
        code: 'MANIFEST_SCHEMA',
        path: issue.path.join('.'),
        message: issue.message,
        severity: 'error',
      });
  }
  const manifest = parsed.success ? parsed.data : null;
  if (manifest) {
    const available = new Map(assets.map((asset) => [asset.id, asset]));
    for (const id of referencedMediaIds(manifest)) {
      const asset = available.get(id);
      if (asset?.state !== 'ready')
        issues.push({
          code: 'MEDIA_NOT_READY',
          path: `media.${id}`,
          message: 'Referenced media is not ready',
          severity: 'error',
        });
      else if (asset.externalUrl && !(await reachability(asset)))
        issues.push({
          code: 'MEDIA_UNREACHABLE',
          path: `media.${id}`,
          message: 'Referenced external media could not be reached safely',
          severity: 'error',
        });
    }
    for (const [index, campaign] of manifest.campaigns.entries()) {
      if (
        campaign.status === 'scheduled' &&
        campaign.scheduledAt &&
        new Date(campaign.scheduledAt) <= now
      )
        issues.push({
          code: 'CAMPAIGN_TIME_PAST',
          path: `campaigns.${index}.scheduledAt`,
          message: 'Scheduled time is in the past; choose Ready for immediate delivery',
          severity: 'error',
        });
    }
    if (manifest.settings.minimumClientContract > 1)
      issues.push({
        code: 'CLIENT_COMPATIBILITY',
        path: 'settings.minimumClientContract',
        message: 'Some installed clients may require an app-store update',
        severity: 'warning',
      });
  }
  const manifestDigest = await digestCanonicalJson(manifestValue);
  const reportDigest = await digestCanonicalJson({ revisionId, manifestDigest, issues });
  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    revisionId,
    manifestDigest,
    reportDigest,
    issues,
  };
}
