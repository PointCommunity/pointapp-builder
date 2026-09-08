import { useEffect, useState } from 'react';
import type { MembershipAuthority } from '../../domain/access';
import { can } from '../../domain/access';
import type { DraftView, ValidationView } from '../api';
import {
  listReleases,
  promoteProduction,
  publishStaging,
  rollbackProduction,
  validateRelease,
} from '../api';
import type { ReleaseView } from '../../server/repositories/releases';

export function ReleasesPanel({
  draft,
  authority,
}: {
  draft: DraftView | null;
  authority: MembershipAuthority;
}) {
  const [items, setItems] = useState<ReleaseView[]>([]);
  const [report, setReport] = useState<ValidationView | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () =>
    listReleases()
      .then((page) => setItems(page.items))
      .catch(() => setStatus('Release history could not be loaded.'));
  useEffect(() => {
    void refresh();
  }, []);
  const staging = items.find((item) => item.channel === 'staging') ?? null;
  const production = items.find((item) => item.channel === 'production') ?? null;
  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setStatus('');
    try {
      await action();
      setStatus(done);
      await refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Release action failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>PointApp releases</h3>
          <p>
            Validate a saved revision, publish it to PointApp Staging, then promote that exact
            signed candidate.
          </p>
        </div>
      </div>
      <div className="channel-grid">
        <article>
          <small>Saved draft</small>
          <strong>{draft ? `Revision ${draft.currentRevision.sequence}` : 'No draft'}</strong>
          <span>{draft?.currentRevision.checksum.slice(0, 12) ?? '—'}</span>
        </article>
        <article>
          <small>PointApp Staging</small>
          <strong>{staging ? staging.manifestDigest.slice(0, 12) : 'Not published'}</strong>
          <span>{staging?.releaseId ?? '—'}</span>
        </article>
        <article>
          <small>PointApp Production</small>
          <strong>{production ? production.manifestDigest.slice(0, 12) : 'Not published'}</strong>
          <span>{production?.releaseId ?? '—'}</span>
        </article>
      </div>
      <div className="release-actions">
        <button
          disabled={!draft || busy}
          onClick={() =>
            draft &&
            void run(
              async () => setReport(await validateRelease(draft.currentRevision.id)),
              'Validation complete.',
            )
          }
          type="button"
        >
          Validate saved revision
        </button>
        <button
          className="button button--primary"
          disabled={!draft || busy || !can(authority, 'staging:publish')}
          onClick={() =>
            draft &&
            void run(
              () => publishStaging(draft.currentRevision.id),
              'Published to PointApp Staging.',
            )
          }
          type="button"
        >
          Publish to Staging
        </button>
        <button
          className="button"
          disabled={!staging || busy || !can(authority, 'production:promote')}
          onClick={() =>
            staging &&
            void run(
              () => promoteProduction(staging.releaseId),
              'Exact Staging candidate promoted to Production.',
            )
          }
          type="button"
        >
          Promote Staging to Production
        </button>
      </div>
      {report && (
        <section className={report.valid ? 'validation-ok' : 'validation-errors'}>
          <strong>{report.valid ? 'Ready to publish' : 'Not ready'}</strong>
          <p>
            {report.issues.length
              ? `${report.issues.length} issue(s)`
              : `Digest ${report.manifestDigest.slice(0, 16)}`}
          </p>
          <ul>
            {report.issues.map((issue) => (
              <li key={`${issue.code}-${issue.path}`}>
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      {status && (
        <p role="status" className="release-status">
          {status}
        </p>
      )}
      <h4>Release history</h4>
      <ol className="release-history">
        {items.map((item) => (
          <li key={item.eventId}>
            <span>
              <strong>
                {item.channel} · {item.eventKind}
              </strong>
              <small>
                {new Date(item.createdAt).toLocaleString()} · {item.manifestDigest.slice(0, 12)}
              </small>
            </span>
            {item.channel === 'production' &&
            item.releaseId !== production?.releaseId &&
            can(authority, 'production:rollback') ? (
              <button
                onClick={() =>
                  void run(
                    () =>
                      rollbackProduction(
                        item.releaseId,
                        'Owner-requested rollback to verified release',
                      ),
                    'Production rolled back.',
                  )
                }
                type="button"
              >
                Rollback here
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
