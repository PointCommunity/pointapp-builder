import type { Capability, MembershipStatus, Role } from '../domain/access';

export interface MembershipView {
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

export interface SessionView {
  state: 'signed-out' | 'pending' | 'disabled' | 'active' | 'unavailable';
  membership: MembershipView | null;
  capabilities: readonly Capability[];
}

export async function loadSession(signal?: AbortSignal): Promise<SessionView> {
  const response = await fetch('/api/session', {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok) throw new Error('Session could not be loaded');
  return (await response.json()) as SessionView;
}

export async function signOut(): Promise<void> {
  const response = await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'sec-fetch-site': 'same-origin' },
  });
  if (!response.ok) throw new Error('Sign-out could not be completed');
}

interface MembershipPage {
  items: MembershipView[];
  nextCursor: string | null;
}

export interface MembershipUpdate {
  expectedVersion: number;
  role?: Role;
  status?: MembershipStatus;
  reason: string;
}

export async function listMemberships(): Promise<MembershipPage> {
  const response = await fetch('/api/memberships', {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Access list could not be loaded');
  return (await response.json()) as MembershipPage;
}

export async function updateMembership(
  githubUserId: string,
  input: MembershipUpdate,
): Promise<MembershipView> {
  const response = await fetch(`/api/memberships/${encodeURIComponent(githubUserId)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Access change could not be saved');
  return (await response.json()) as MembershipView;
}
