import { canManageMembership, type MembershipStatus, type Role } from '../../domain/access';
import { appendAuditEvent } from '../audit';
import { ProblemError } from '../problems';
import { requireMembership, type Membership } from '../repositories/memberships';

export interface UpdateMembershipInput {
  actor: Membership;
  targetGithubUserId: string;
  expectedVersion: number;
  role: Role;
  status: MembershipStatus;
  reason: string;
  requestId: string;
}

export async function updateMembership(
  database: D1Database,
  input: UpdateMembershipInput,
): Promise<Membership> {
  const target = await requireMembership(database, input.targetGithubUserId);
  if (
    input.actor.status !== 'active' ||
    !canManageMembership(input.actor.role, target.role, input.role)
  ) {
    await appendAuditEvent(database, {
      id: crypto.randomUUID(),
      requestId: input.requestId,
      actor: input.actor,
      action: 'membership.update',
      targetType: 'membership',
      targetId: target.githubUserId,
      outcome: 'denied',
      reason: 'Insufficient authority',
    });
    throw new ProblemError(403, 'FORBIDDEN', 'You may not manage this membership');
  }
  if (target.version !== input.expectedVersion) {
    throw new ProblemError(
      409,
      'MEMBERSHIP_CONFLICT',
      'The membership changed; reload and try again',
    );
  }
  const removesActiveOwner =
    target.role === 'owner' &&
    target.status === 'active' &&
    (input.role !== 'owner' || input.status !== 'active');
  const now = new Date().toISOString();
  const ownerGuard = removesActiveOwner
    ? " AND (SELECT COUNT(*) FROM memberships WHERE role = 'owner' AND status = 'active') > 1"
    : '';
  const result = await database
    .prepare(
      `UPDATE memberships SET role = ?, status = ?, version = version + 1,
         approved_at = CASE WHEN ? = 'active' THEN COALESCE(approved_at, ?) ELSE approved_at END,
         approved_by = CASE WHEN ? = 'active' THEN ? ELSE approved_by END,
         disabled_at = CASE WHEN ? = 'disabled' THEN ? ELSE NULL END,
         disabled_by = CASE WHEN ? = 'disabled' THEN ? ELSE NULL END
       WHERE github_user_id = ? AND version = ?${ownerGuard}`,
    )
    .bind(
      input.role,
      input.status,
      input.status,
      now,
      input.status,
      input.actor.githubUserId,
      input.status,
      now,
      input.status,
      input.actor.githubUserId,
      input.targetGithubUserId,
      input.expectedVersion,
    )
    .run();
  if ((result.meta.changes ?? 0) !== 1) {
    const current = await requireMembership(database, input.targetGithubUserId);
    if (current.version === input.expectedVersion && removesActiveOwner) {
      throw new ProblemError(409, 'LAST_OWNER_REQUIRED', 'At least one Active Owner is required');
    }
    throw new ProblemError(
      409,
      'MEMBERSHIP_CONFLICT',
      'The membership changed; reload and try again',
    );
  }
  const updated = await requireMembership(database, input.targetGithubUserId);
  await appendAuditEvent(database, {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    actor: input.actor,
    action: 'membership.update',
    targetType: 'membership',
    targetId: updated.githubUserId,
    outcome: 'succeeded',
    reason: input.reason,
    metadata: { role: updated.role, status: updated.status, version: updated.version },
  });
  return updated;
}
