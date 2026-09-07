export const roles = ['editor', 'publisher', 'administrator', 'owner'] as const;
export type Role = (typeof roles)[number];

export const membershipStatuses = ['pending', 'active', 'disabled'] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const capabilities = [
  'draft:read',
  'draft:write',
  'asset:manage',
  'staging:publish',
  'production:promote',
  'production:rollback',
  'access:read',
  'access:manage-basic',
  'access:manage-admin',
  'settings:manage',
  'audit:read',
  'operations:read',
] as const;
export type Capability = (typeof capabilities)[number];

export interface MembershipAuthority {
  role: Role;
  status: MembershipStatus;
}

const roleCapabilities: Record<Role, ReadonlySet<Capability>> = {
  editor: new Set(['draft:read', 'draft:write', 'asset:manage']),
  publisher: new Set(['draft:read', 'draft:write', 'asset:manage', 'staging:publish']),
  administrator: new Set([
    'draft:read',
    'draft:write',
    'asset:manage',
    'staging:publish',
    'production:promote',
    'access:read',
    'access:manage-basic',
    'settings:manage',
  ]),
  owner: new Set(capabilities),
};

export function can(authority: Role | MembershipAuthority, capability: Capability): boolean {
  const membership =
    typeof authority === 'string' ? { role: authority, status: 'active' as const } : authority;
  return membership.status === 'active' && roleCapabilities[membership.role].has(capability);
}

export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  return canManageMembership(actorRole, targetRole, targetRole);
}

export function canManageMembership(
  actorRole: Role,
  targetRole: Role,
  assignedRole: Role,
): boolean {
  if (actorRole === 'owner') return true;
  return (
    actorRole === 'administrator' &&
    (targetRole === 'editor' || targetRole === 'publisher') &&
    (assignedRole === 'editor' || assignedRole === 'publisher')
  );
}

export function capabilitiesFor(authority: MembershipAuthority): Capability[] {
  return capabilities.filter((capability) => can(authority, capability));
}
