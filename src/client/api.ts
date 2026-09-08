import type { Capability, MembershipStatus, Role } from '../domain/access';
import type { AppManifest } from '../content/manifest';
import type { MediaAsset } from '../server/repositories/media';
import type { ReleaseView } from '../server/repositories/releases';

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
  });
  if (!response.ok) throw new Error('Sign-out could not be completed');
}

export interface RevisionView {
  id: string;
  draftId: string;
  parentRevisionId: string | null;
  sequence: number;
  checksum: string;
  schemaVersion: number;
  label: string;
  createdBy: string;
  createdAt: string;
}
export interface DraftView {
  id: string;
  name: string;
  state: 'active' | 'archived';
  version: number;
  currentRevision: RevisionView;
  updatedAt: string;
  manifest: AppManifest;
}
export interface ValidationView {
  valid: boolean;
  revisionId: string;
  manifestDigest: string;
  reportDigest: string;
  issues: Array<{ code: string; path: string; message: string; severity: 'error' | 'warning' }>;
}
export interface OperationsView {
  health: { database: string };
  channels: { staging: ReleaseView | null; production: ReleaseView | null };
  capacity: Record<string, number>;
}
export interface AuditView {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: string;
  reason: string | null;
  occurredAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
async function requestJson<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: { accept: 'application/json', ...init.headers },
    });
  } catch (error) {
    if (retry && (!init.method || init.method === 'GET')) return requestJson<T>(path, init, false);
    throw error;
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as {
      code?: string;
      detail?: string;
      title?: string;
      fields?: Record<string, string[]>;
    };
    throw new ApiError(
      response.status,
      problem.code ?? 'REQUEST_FAILED',
      problem.detail ?? problem.title ?? 'The request failed',
      problem.fields,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
const mutationHeaders = () => ({
  'content-type': 'application/json',
  'idempotency-key': crypto.randomUUID(),
});

export async function listDrafts(includeArchived = false) {
  return requestJson<{ items: DraftView[]; nextCursor: null }>(
    `/api/drafts${includeArchived ? '?state=all' : ''}`,
  );
}
export async function createDraft(name: string, duplicateRevisionId?: string) {
  return requestJson<DraftView>('/api/drafts', {
    method: 'POST',
    headers: mutationHeaders(),
    body: JSON.stringify({ name, duplicateRevisionId }),
  });
}
export async function updateDraft(
  draft: DraftView,
  change: { name?: string; state?: 'active' | 'archived' },
) {
  return requestJson<DraftView>(`/api/drafts/${draft.id}`, {
    method: 'PATCH',
    headers: mutationHeaders(),
    body: JSON.stringify({ expectedVersion: draft.version, ...change }),
  });
}
export async function saveRevision(draft: DraftView, manifest: AppManifest, label: string) {
  return requestJson<DraftView>(`/api/drafts/${draft.id}/revisions`, {
    method: 'POST',
    headers: mutationHeaders(),
    body: JSON.stringify({ expectedParentRevisionId: draft.currentRevision.id, label, manifest }),
  });
}
export async function listRevisions(draftId: string) {
  return requestJson<{ items: RevisionView[]; nextCursor: null }>(
    `/api/drafts/${draftId}/revisions`,
  );
}
export async function listMedia() {
  return requestJson<{ items: MediaAsset[]; nextCursor: null }>('/api/media');
}
export async function createMedia(metadata: Record<string, unknown>, file?: File) {
  const form = new FormData();
  form.set('metadata', JSON.stringify(metadata));
  if (file) form.set('file', file);
  return requestJson<MediaAsset>('/api/media', {
    method: 'POST',
    headers: { 'idempotency-key': crypto.randomUUID() },
    body: form,
  });
}
export async function changeMediaState(id: string, state: 'ready' | 'archived') {
  return requestJson<MediaAsset>(`/api/media/${id}`, {
    method: 'PATCH',
    headers: mutationHeaders(),
    body: JSON.stringify({ state }),
  });
}
export async function validateRelease(revisionId: string) {
  return requestJson<ValidationView>('/api/releases/validate', {
    method: 'POST',
    headers: mutationHeaders(),
    body: JSON.stringify({ revisionId }),
  });
}
export async function listReleases() {
  return requestJson<{ items: ReleaseView[]; nextCursor: null }>('/api/releases');
}
export async function publishStaging(revisionId: string) {
  return requestJson<ReleaseView>('/api/releases/staging', {
    method: 'POST',
    headers: mutationHeaders(),
    body: JSON.stringify({ revisionId }),
  });
}
export async function promoteProduction(stagingReleaseId: string) {
  return requestJson<ReleaseView>('/api/releases/production/promotions', {
    method: 'POST',
    headers: mutationHeaders(),
    body: JSON.stringify({ stagingReleaseId }),
  });
}
export async function rollbackProduction(releaseId: string, reason: string) {
  return requestJson<ReleaseView>('/api/releases/production/rollbacks', {
    method: 'POST',
    headers: mutationHeaders(),
    body: JSON.stringify({ releaseId, reason }),
  });
}
export async function loadOperations() {
  return requestJson<OperationsView>('/api/operations');
}
export async function loadAudit() {
  return requestJson<{ items: AuditView[]; nextCursor: string | null }>('/api/audit');
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
