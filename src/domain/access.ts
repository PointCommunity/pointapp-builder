export const roles = ['editor', 'publisher', 'administrator', 'owner'] as const;
export type Role = (typeof roles)[number];

export const capabilities = [
  'draft:read',
  'draft:write',
  'asset:manage',
  'staging:publish',
  'production:promote',
  'access:manage-basic',
  'access:manage-admin',
  'settings:manage',
] as const;
export type Capability = (typeof capabilities)[number];

const roleCapabilities: Record<Role, ReadonlySet<Capability>> = {
  editor: new Set(['draft:read', 'draft:write', 'asset:manage']),
  publisher: new Set(['draft:read', 'draft:write', 'asset:manage', 'staging:publish']),
  administrator: new Set([
    'draft:read',
    'draft:write',
    'asset:manage',
    'staging:publish',
    'production:promote',
    'access:manage-basic',
    'settings:manage',
  ]),
  owner: new Set(capabilities),
};

export function can(role: Role, capability: Capability): boolean {
  return roleCapabilities[role].has(capability);
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'owner') return true;
  return actorRole === 'administrator' && (targetRole === 'editor' || targetRole === 'publisher');
}
