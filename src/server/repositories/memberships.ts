import type { MembershipStatus, Role } from '../../domain/access';
import type { GitHubIdentity } from '../auth';
import { listRows, requireRow } from '../d1';

interface MembershipRow {
  github_user_id: string;
  login: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  status: MembershipStatus;
  version: number;
  requested_at: string;
  approved_at: string | null;
  disabled_at: string | null;
}

export interface Membership {
  githubUserId: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
  status: MembershipStatus;
  version: number;
  requestedAt: string;
  approvedAt: string | null;
  disabledAt: string | null;
}

function toMembership(row: MembershipRow): Membership {
  return {
    githubUserId: row.github_user_id,
    login: row.login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    version: row.version,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
    disabledAt: row.disabled_at,
  };
}

const membershipColumns = `github_user_id, login, display_name, avatar_url, role, status,
  version, requested_at, approved_at, disabled_at`;

export async function getMembership(
  database: D1Database,
  githubUserId: string,
): Promise<Membership | null> {
  const row = await database
    .prepare(`SELECT ${membershipColumns} FROM memberships WHERE github_user_id = ?`)
    .bind(githubUserId)
    .first<MembershipRow>();
  return row ? toMembership(row) : null;
}

export async function requireMembership(
  database: D1Database,
  githubUserId: string,
): Promise<Membership> {
  return toMembership(
    await requireRow<MembershipRow>(
      database
        .prepare(`SELECT ${membershipColumns} FROM memberships WHERE github_user_id = ?`)
        .bind(githubUserId),
      'MEMBERSHIP_NOT_FOUND',
      'The membership does not exist',
    ),
  );
}

export async function registerIdentity(
  database: D1Database,
  identity: GitHubIdentity,
  bootstrapOwnerGitHubId: string,
  now = new Date(),
): Promise<Membership> {
  const githubUserId = String(identity.id);
  const timestamp = now.toISOString();
  await database
    .prepare(
      `INSERT OR IGNORE INTO memberships
       (github_user_id, login, display_name, avatar_url, role, status, requested_at, approved_at)
       SELECT ?, ?, ?, ?,
         CASE WHEN ? = ? AND NOT EXISTS (
           SELECT 1 FROM memberships WHERE role = 'owner' AND status = 'active'
         ) THEN 'owner' ELSE 'editor' END,
         CASE WHEN ? = ? AND NOT EXISTS (
           SELECT 1 FROM memberships WHERE role = 'owner' AND status = 'active'
         ) THEN 'active' ELSE 'pending' END,
         ?, CASE WHEN ? = ? AND NOT EXISTS (
           SELECT 1 FROM memberships WHERE role = 'owner' AND status = 'active'
         ) THEN ? ELSE NULL END`,
    )
    .bind(
      githubUserId,
      identity.login,
      identity.displayName,
      identity.avatarUrl,
      githubUserId,
      bootstrapOwnerGitHubId,
      githubUserId,
      bootstrapOwnerGitHubId,
      timestamp,
      githubUserId,
      bootstrapOwnerGitHubId,
      timestamp,
    )
    .run();

  await database
    .prepare(
      `UPDATE memberships SET login = ?, display_name = ?, avatar_url = ?
       WHERE github_user_id = ?`,
    )
    .bind(identity.login, identity.displayName, identity.avatarUrl, githubUserId)
    .run();
  return requireMembership(database, githubUserId);
}

export async function listMemberships(
  database: D1Database,
  actor: Membership,
  limit: number,
  before?: string,
) {
  const scope =
    actor.role === 'owner'
      ? 'github_user_id <> ?'
      : "github_user_id <> ? AND role IN ('editor', 'publisher')";
  const rows = await listRows<MembershipRow>(
    database
      .prepare(
        `SELECT ${membershipColumns} FROM memberships
         WHERE ${scope} AND (? IS NULL OR requested_at < ?)
         ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
                  requested_at DESC, github_user_id DESC LIMIT ?`,
      )
      .bind(actor.githubUserId, before ?? null, before ?? null, limit + 1),
  );
  const visible = rows.slice(0, limit);
  return {
    items: visible.map(toMembership),
    nextCursor: rows.length > limit ? (visible.at(-1)?.requested_at ?? null) : null,
  };
}
