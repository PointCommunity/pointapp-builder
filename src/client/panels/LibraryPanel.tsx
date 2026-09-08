import { useEffect, useState } from 'react';
import type { MediaAsset } from '../../server/repositories/media';
import { changeMediaState, createMedia, invalidateMediaOptions, listMedia } from '../api';

export function LibraryPanel({ readOnly }: { readOnly?: boolean }) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<'image' | 'audio' | 'video'>('image');
  const refresh = () =>
    listMedia()
      .then((page) => setAssets(page.items))
      .catch(() => setError('Media library could not be loaded.'));
  useEffect(() => {
    void refresh();
  }, []);
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await createMedia(
        {
          kind,
          title: data.get('title'),
          altText: data.get('altText') || undefined,
          externalUrl: data.get('externalUrl') || undefined,
          captionUrl: data.get('captionUrl') || undefined,
        },
        (data.get('file') as File)?.size ? (data.get('file') as File) : undefined,
      );
      invalidateMediaOptions();
      form.reset();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Media could not be added.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>Media library</h3>
          <p>Upload bounded images or register accessible external audio and video.</p>
        </div>
      </div>
      <form
        className="form-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label>
          Kind
          <select
            value={kind}
            disabled={readOnly}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option>image</option>
            <option>audio</option>
            <option>video</option>
          </select>
        </label>
        <label>
          Title
          <input name="title" required maxLength={120} disabled={readOnly} />
        </label>
        {kind === 'image' ? (
          <>
            <label>
              Alt text
              <textarea name="altText" required maxLength={500} disabled={readOnly} />
            </label>
            <label>
              Image
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                required
                disabled={readOnly}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              HTTPS media URL
              <input
                name="externalUrl"
                type="url"
                pattern="https://.*"
                required
                disabled={readOnly}
              />
            </label>
            <label>
              HTTPS caption/transcript URL
              <input
                name="captionUrl"
                type="url"
                pattern="https://.*"
                required
                disabled={readOnly}
              />
            </label>
          </>
        )}
        <button className="button button--primary" disabled={readOnly || busy} type="submit">
          {busy ? 'Adding…' : 'Add media'}
        </button>
      </form>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <ul className="media-grid">
        {assets.map((asset) => (
          <li key={asset.id}>
            <div className="media-thumb">
              {asset.kind === 'image' ? '▧' : asset.kind === 'video' ? '▶' : '♪'}
            </div>
            <strong>{asset.title}</strong>
            <span>
              {asset.kind} · {asset.state}
            </span>
            <code>{asset.id}</code>
            {asset.kind === 'image' && (
              <img src={`/api/media/${asset.id}`} alt={asset.altText ?? ''} />
            )}
            <button
              disabled={readOnly}
              onClick={() => {
                setError('');
                void changeMediaState(asset.id, asset.state === 'ready' ? 'archived' : 'ready')
                  .then(() => {
                    invalidateMediaOptions();
                    return refresh();
                  })
                  .catch((cause) =>
                    setError(
                      cause instanceof Error ? cause.message : 'Media could not be updated.',
                    ),
                  );
              }}
              type="button"
            >
              {asset.state === 'ready' ? 'Archive' : 'Recover'}
            </button>
          </li>
        ))}
      </ul>
      {assets.length === 0 && !error && <p className="empty-state">No media has been added.</p>}
    </div>
  );
}
