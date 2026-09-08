import { useEffect, useState } from 'react';
import type { MediaAsset } from '../../server/repositories/media';
import { listMediaOptions } from '../api';

export function MediaSelect({
  label,
  kind,
  value,
  optional = false,
  disabled = false,
  onChange,
}: {
  label: string;
  kind: MediaAsset['kind'];
  value: string | null;
  optional?: boolean;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    void listMediaOptions()
      .then((page) => {
        if (current) setAssets(page.items.filter((asset) => asset.state === 'ready'));
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, []);
  const options = assets.filter((asset) => asset.kind === kind);
  return (
    <label>
      {label}
      <select
        value={value ?? ''}
        disabled={disabled}
        aria-invalid={!optional && !options.some((asset) => asset.id === value)}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{optional ? 'No media' : `Choose ${kind}`}</option>
        {options.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.title}
          </option>
        ))}
      </select>
      {failed ? <small className="field-error">Media choices could not be loaded.</small> : null}
      {!failed && options.length === 0 ? (
        <small className="muted">Add ready {kind} media in Library first.</small>
      ) : null}
    </label>
  );
}
