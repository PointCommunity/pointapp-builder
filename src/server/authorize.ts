import { can, capabilitiesFor, type Capability } from '../domain/access';
import { AuthenticationError, GitHubSessionCodec, type GitHubIdentity } from './auth';
import { ProblemError } from './problems';
import { getMembership, type Membership } from './repositories/memberships';

export interface SessionResolution {
  state: 'signed-out' | 'pending' | 'disabled' | 'active' | 'unavailable';
  identity: GitHubIdentity | null;
  membership: Membership | null;
  capabilities: Capability[];
}

export async function resolveSession(
  request: Request,
  database: D1Database,
  sessions?: GitHubSessionCodec,
): Promise<SessionResolution> {
  if (!sessions)
    return { state: 'unavailable', identity: null, membership: null, capabilities: [] };
  let identity: GitHubIdentity;
  try {
    identity = await sessions.identityFromRequest(request);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { state: 'signed-out', identity: null, membership: null, capabilities: [] };
    }
    throw error;
  }
  const membership = await getMembership(database, String(identity.id));
  if (!membership)
    return { state: 'signed-out', identity: null, membership: null, capabilities: [] };
  return {
    state: membership.status,
    identity,
    membership,
    capabilities: capabilitiesFor(membership),
  };
}

export async function requireActiveMembership(
  request: Request,
  database: D1Database,
  sessions: GitHubSessionCodec | undefined,
  capability?: Capability,
): Promise<Membership> {
  const session = await resolveSession(request, database, sessions);
  if (session.state === 'signed-out' || session.state === 'unavailable' || !session.membership) {
    throw new AuthenticationError();
  }
  if (session.state === 'pending') {
    throw new ProblemError(
      403,
      'MEMBERSHIP_PENDING',
      'Your access request is waiting for Owner approval',
    );
  }
  if (session.state === 'disabled') {
    throw new ProblemError(403, 'MEMBERSHIP_DISABLED', 'Your Builder access is disabled');
  }
  if (capability && !can(session.membership, capability)) {
    throw new ProblemError(403, 'FORBIDDEN', 'You do not have permission for this operation');
  }
  return session.membership;
}
