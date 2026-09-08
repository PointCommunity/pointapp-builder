import { updateManifest, type ManifestPanelProps } from './types';
import { MediaSelect } from '../components/MediaSelect';
export function BrandingPanel({ manifest, onChange, readOnly }: ManifestPanelProps) {
  const setApp = (key: keyof typeof manifest.app, value: string) =>
    onChange(
      updateManifest(manifest, (next) => {
        next.app[key] = value;
      }),
    );
  const colors = ['accent', 'accentContrast', 'background', 'surface', 'text', 'muted'] as const;
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>Branding</h3>
          <p>App identity and approved presentation tokens.</p>
        </div>
      </div>
      <label>
        App name
        <input
          value={manifest.app.name}
          disabled={readOnly}
          onChange={(event) => setApp('name', event.target.value)}
        />
      </label>
      <label>
        Short name
        <input
          value={manifest.app.shortName}
          disabled={readOnly}
          maxLength={18}
          onChange={(event) => setApp('shortName', event.target.value)}
        />
      </label>
      <label>
        Tagline
        <textarea
          value={manifest.app.tagline}
          disabled={readOnly}
          onChange={(event) => setApp('tagline', event.target.value)}
        />
      </label>
      <MediaSelect
        label="App logo"
        kind="image"
        value={manifest.theme.logoMediaId}
        optional
        disabled={readOnly}
        onChange={(logoMediaId) =>
          onChange(
            updateManifest(manifest, (next) => {
              next.theme.logoMediaId = logoMediaId;
            }),
          )
        }
      />
      <div className="color-grid">
        {colors.map((color) => (
          <label key={color}>
            {color}
            <span>
              <input
                type="color"
                value={manifest.theme[color]}
                disabled={readOnly}
                onChange={(event) =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      next.theme[color] = event.target.value;
                    }),
                  )
                }
              />
              <code>{manifest.theme[color]}</code>
            </span>
          </label>
        ))}
      </div>
      <label>
        Typography
        <select
          value={manifest.theme.typographyScale}
          disabled={readOnly}
          onChange={(event) =>
            onChange(
              updateManifest(manifest, (next) => {
                next.theme.typographyScale = event.target
                  .value as typeof next.theme.typographyScale;
              }),
            )
          }
        >
          <option>compact</option>
          <option>standard</option>
          <option>large</option>
        </select>
      </label>
      <label>
        Corner style
        <select
          value={manifest.theme.cornerStyle}
          disabled={readOnly}
          onChange={(event) =>
            onChange(
              updateManifest(manifest, (next) => {
                next.theme.cornerStyle = event.target.value as typeof next.theme.cornerStyle;
              }),
            )
          }
        >
          <option>square</option>
          <option>soft</option>
          <option>round</option>
        </select>
      </label>
      <label>
        Color mode
        <select
          value={manifest.theme.colorMode}
          disabled={readOnly}
          onChange={(event) =>
            onChange(
              updateManifest(manifest, (next) => {
                next.theme.colorMode = event.target.value as typeof next.theme.colorMode;
              }),
            )
          }
        >
          <option>light</option>
          <option>dark</option>
          <option>system</option>
        </select>
      </label>
    </div>
  );
}
