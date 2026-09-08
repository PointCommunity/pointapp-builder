PRAGMA foreign_keys = ON;

CREATE TABLE memberships (
  github_user_id TEXT PRIMARY KEY,
  login TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'publisher', 'administrator', 'owner')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approved_at TEXT,
  approved_by TEXT REFERENCES memberships(github_user_id),
  disabled_at TEXT,
  disabled_by TEXT REFERENCES memberships(github_user_id)
);

CREATE INDEX memberships_status_requested_idx ON memberships(status, requested_at);

CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  current_revision_id TEXT REFERENCES manifest_revisions(id),
  created_by TEXT NOT NULL REFERENCES memberships(github_user_id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT REFERENCES memberships(github_user_id),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_by TEXT REFERENCES memberships(github_user_id),
  archived_at TEXT
);

CREATE INDEX drafts_state_updated_idx ON drafts(state, updated_at DESC);

CREATE TABLE manifest_revisions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id),
  parent_revision_id TEXT REFERENCES manifest_revisions(id),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  checksum TEXT NOT NULL CHECK (length(checksum) = 64),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  created_by TEXT NOT NULL REFERENCES memberships(github_user_id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (draft_id, sequence)
);

CREATE TRIGGER manifest_revisions_no_update
BEFORE UPDATE ON manifest_revisions
BEGIN
  SELECT RAISE(ABORT, 'manifest revisions are immutable');
END;

CREATE TRIGGER manifest_revisions_no_delete
BEFORE DELETE ON manifest_revisions
BEGIN
  SELECT RAISE(ABORT, 'manifest revisions are immutable');
END;

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'video')),
  state TEXT NOT NULL DEFAULT 'ready' CHECK (state IN ('ready', 'archived')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  filename TEXT,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
  width INTEGER CHECK (width > 0),
  height INTEGER CHECK (height > 0),
  duration_seconds REAL CHECK (duration_seconds >= 0),
  alt_text TEXT,
  caption_url TEXT,
  external_url TEXT,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  created_by TEXT NOT NULL REFERENCES memberships(github_user_id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_by TEXT REFERENCES memberships(github_user_id),
  archived_at TEXT
);

CREATE INDEX media_assets_state_created_idx ON media_assets(state, created_at DESC);

CREATE TABLE media_chunks (
  media_id TEXT NOT NULL REFERENCES media_assets(id),
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  byte_length INTEGER NOT NULL CHECK (byte_length > 0),
  payload BLOB NOT NULL,
  PRIMARY KEY (media_id, chunk_index)
) WITHOUT ROWID;

CREATE TABLE signing_keys (
  key_id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL CHECK (algorithm = 'Ed25519'),
  public_jwk TEXT NOT NULL CHECK (json_valid(public_jwk)),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'retired')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  retired_at TEXT
);

CREATE TABLE release_envelopes (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES manifest_revisions(id),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
  validation_digest TEXT NOT NULL CHECK (length(validation_digest) = 64),
  key_id TEXT NOT NULL REFERENCES signing_keys(key_id),
  algorithm TEXT NOT NULL CHECK (algorithm = 'Ed25519'),
  signature TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES memberships(github_user_id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (revision_id, manifest_digest, key_id)
);

CREATE TRIGGER release_envelopes_no_update
BEFORE UPDATE ON release_envelopes
BEGIN
  SELECT RAISE(ABORT, 'release envelopes are immutable');
END;

CREATE TRIGGER release_envelopes_no_delete
BEFORE DELETE ON release_envelopes
BEGIN
  SELECT RAISE(ABORT, 'release envelopes are immutable');
END;

CREATE TABLE channel_events (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('staging', 'production')),
  kind TEXT NOT NULL CHECK (kind IN ('publish', 'promote', 'rollback')),
  release_id TEXT NOT NULL REFERENCES release_envelopes(id),
  prior_event_id TEXT REFERENCES channel_events(id),
  reason TEXT CHECK (reason IS NULL OR length(reason) BETWEEN 3 AND 240),
  created_by TEXT NOT NULL REFERENCES memberships(github_user_id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX channel_events_channel_created_idx ON channel_events(channel, created_at DESC);

CREATE TRIGGER channel_events_no_update
BEFORE UPDATE ON channel_events
BEGIN
  SELECT RAISE(ABORT, 'channel events are immutable');
END;

CREATE TRIGGER channel_events_no_delete
BEFORE DELETE ON channel_events
BEGIN
  SELECT RAISE(ABORT, 'channel events are immutable');
END;

CREATE TABLE channel_pointers (
  channel TEXT PRIMARY KEY CHECK (channel IN ('staging', 'production')),
  event_id TEXT NOT NULL REFERENCES channel_events(id),
  release_id TEXT NOT NULL REFERENCES release_envelopes(id),
  version INTEGER NOT NULL CHECK (version > 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  actor_github_user_id TEXT REFERENCES memberships(github_user_id),
  actor_role TEXT CHECK (actor_role IS NULL OR actor_role IN ('editor', 'publisher', 'administrator', 'owner')),
  actor_status TEXT CHECK (actor_status IS NULL OR actor_status IN ('pending', 'active', 'disabled')),
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  target_type TEXT NOT NULL CHECK (length(target_type) BETWEEN 1 AND 40),
  target_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 240),
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX audit_events_occurred_idx ON audit_events(occurred_at DESC, id DESC);

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are immutable');
END;

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are immutable');
END;

CREATE TABLE idempotency_records (
  actor_github_user_id TEXT NOT NULL REFERENCES memberships(github_user_id),
  operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 80),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  state TEXT NOT NULL CHECK (state IN ('in_progress', 'completed')),
  response_status INTEGER,
  response_json TEXT CHECK (response_json IS NULL OR json_valid(response_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (actor_github_user_id, operation, idempotency_key)
) WITHOUT ROWID;
