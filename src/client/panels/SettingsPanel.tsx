import { updateManifest, type ManifestPanelProps } from './types';
export function SettingsPanel({ manifest, onChange, readOnly }: ManifestPanelProps) {
  const fields = [
    'organizationName',
    'supportUrl',
    'privacyUrl',
    'termsUrl',
    'locale',
    'timeZone',
  ] as const;
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>App settings</h3>
          <p>Organization, support, compatibility, and refresh behavior.</p>
        </div>
      </div>
      {fields.map((field) => (
        <label key={field}>
          {field}
          <input
            value={manifest.settings[field]}
            disabled={readOnly}
            onChange={(event) =>
              onChange(
                updateManifest(manifest, (next) => {
                  next.settings[field] = event.target.value;
                }),
              )
            }
          />
        </label>
      ))}
      <label>
        Refresh interval (seconds)
        <input
          type="number"
          min={30}
          max={86400}
          value={manifest.settings.refreshSeconds}
          disabled={readOnly}
          onChange={(event) =>
            onChange(
              updateManifest(manifest, (next) => {
                next.settings.refreshSeconds = Number(event.target.value);
              }),
            )
          }
        />
      </label>
      <label>
        Minimum client contract
        <input
          type="number"
          min={1}
          max={100}
          value={manifest.settings.minimumClientContract}
          disabled={readOnly}
          onChange={(event) =>
            onChange(
              updateManifest(manifest, (next) => {
                next.settings.minimumClientContract = Number(event.target.value);
              }),
            )
          }
        />
      </label>
    </div>
  );
}
