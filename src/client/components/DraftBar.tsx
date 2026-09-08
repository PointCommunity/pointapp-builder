import { useState } from 'react';
import type { DraftView, RevisionView } from '../api';

export function DraftBar({
  loading,
  drafts,
  draft,
  dirty,
  saving,
  revisions,
  onSelect,
  onCreate,
  onDuplicate,
  onSave,
  onRename,
  onArchive,
  onRecover,
}: {
  loading: boolean;
  drafts: DraftView[];
  draft: DraftView | null;
  dirty: boolean;
  saving: boolean;
  revisions: RevisionView[];
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onSave: (label: string) => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onRecover: () => Promise<void>;
}) {
  const [name, setName] = useState('PointApp');
  const [label, setLabel] = useState('Content update');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  if (loading)
    return (
      <section className="draft-bar" aria-label="Draft and revision controls">
        <p role="status">Loading drafts…</p>
      </section>
    );
  return (
    <section className="draft-bar" aria-label="Draft and revision controls">
      <label>
        Draft
        <select value={draft?.id ?? ''} onChange={(event) => onSelect(event.target.value)}>
          <option value="" disabled>
            Select a draft
          </option>
          {drafts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.state === 'archived' ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </label>
      {!draft ? (
        <>
          <label>
            New draft name
            <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </label>
          <button
            className="button button--primary"
            onClick={() => void onCreate(name)}
            type="button"
          >
            Create first draft
          </button>
        </>
      ) : (
        <>
          <label>
            Revision label
            <input
              value={label}
              maxLength={120}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <button
            className="button button--primary"
            disabled={!dirty || saving || draft.state === 'archived'}
            onClick={() => void onSave(label)}
            type="button"
          >
            {saving ? 'Saving…' : dirty ? 'Save new revision' : 'Saved'}
          </button>
          <details>
            <summary>Draft actions</summary>
            <div className="draft-actions">
              {renaming ? (
                <form
                  className="inline-rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = renameValue.trim();
                    if (!value) return;
                    void onRename(value).then(() => setRenaming(false));
                  }}
                >
                  <label>
                    Draft name
                    <input
                      autoFocus
                      maxLength={80}
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                    />
                  </label>
                  <button type="submit">Save name</button>
                  <button type="button" onClick={() => setRenaming(false)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRenameValue(draft.name);
                    setRenaming(true);
                  }}
                >
                  Rename
                </button>
              )}
              <button type="button" onClick={() => void onDuplicate()}>
                Duplicate
              </button>
              {draft.state === 'active' ? (
                <button type="button" onClick={() => void onArchive()}>
                  Archive
                </button>
              ) : (
                <button type="button" onClick={() => void onRecover()}>
                  Recover
                </button>
              )}
            </div>
          </details>
          <span className="revision-chip">
            Revision {draft.currentRevision.sequence} · {draft.currentRevision.checksum.slice(0, 8)}
          </span>
          <details>
            <summary>History ({revisions.length})</summary>
            <ol className="revision-list">
              {revisions.map((revision) => (
                <li key={revision.id}>
                  <strong>r{revision.sequence}</strong> {revision.label}
                  <small>{new Date(revision.createdAt).toLocaleString()}</small>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}
