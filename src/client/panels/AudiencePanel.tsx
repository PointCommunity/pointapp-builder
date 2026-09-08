import { newId, updateManifest, type ManifestPanelProps } from './types';
export function AudiencePanel({ manifest, onChange, readOnly }: ManifestPanelProps) {
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>Audience segments</h3>
          <p>Define labels only—no member personal data is stored here.</p>
        </div>
        <button
          disabled={readOnly || manifest.audiences.length >= 50}
          onClick={() =>
            onChange(
              updateManifest(manifest, (next) =>
                next.audiences.push({
                  id: newId('audience'),
                  name: 'New audience',
                  description: '',
                }),
              ),
            )
          }
          type="button"
        >
          Add audience
        </button>
      </div>
      {manifest.audiences.map((audience, index) => (
        <article className="form-card" key={audience.id}>
          <label>
            Name
            <input
              value={audience.name}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.audiences[index].name = event.target.value;
                  }),
                )
              }
            />
          </label>
          <label>
            Description
            <textarea
              value={audience.description}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.audiences[index].description = event.target.value;
                  }),
                )
              }
            />
          </label>
          <button
            disabled={
              readOnly ||
              manifest.screens.some(
                (screen) =>
                  screen.audienceIds.includes(audience.id) ||
                  screen.elements.some((element) => element.audienceIds.includes(audience.id)),
              ) ||
              manifest.campaigns.some((campaign) => campaign.audienceId === audience.id)
            }
            onClick={() =>
              onChange(updateManifest(manifest, (next) => next.audiences.splice(index, 1)))
            }
            type="button"
          >
            Delete audience
          </button>
        </article>
      ))}
    </div>
  );
}
