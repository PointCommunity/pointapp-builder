import type { AppManifest } from '../../content/manifest';

export interface ManifestPanelProps {
  manifest: AppManifest;
  onChange: (manifest: AppManifest) => void;
  readOnly?: boolean;
}
export function updateManifest(
  manifest: AppManifest,
  update: (draft: AppManifest) => void,
): AppManifest {
  const next = structuredClone(manifest);
  update(next);
  return next;
}
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
