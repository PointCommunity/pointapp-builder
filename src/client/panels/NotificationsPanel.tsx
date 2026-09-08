import { newId, updateManifest, type ManifestPanelProps } from './types';
export function NotificationsPanel({ manifest, onChange, readOnly }: ManifestPanelProps) {
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>Notification campaigns</h3>
          <p>Campaigns ship as signed content. Native push delivery is not yet connected.</p>
        </div>
        <button
          disabled={readOnly}
          onClick={() =>
            onChange(
              updateManifest(manifest, (next) =>
                next.campaigns.push({
                  id: newId('campaign'),
                  title: 'New update',
                  body: 'What should people know?',
                  destination: '/',
                  audienceId: null,
                  status: 'draft',
                  scheduledAt: null,
                }),
              ),
            )
          }
          type="button"
        >
          New campaign
        </button>
      </div>
      {manifest.campaigns.length === 0 && (
        <p className="empty-state">No notification campaigns yet.</p>
      )}
      {manifest.campaigns.map((campaign, index) => (
        <article className="form-card" key={campaign.id}>
          <label>
            Title
            <input
              value={campaign.title}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.campaigns[index].title = event.target.value;
                  }),
                )
              }
            />
          </label>
          <label>
            Body
            <textarea
              value={campaign.body}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.campaigns[index].body = event.target.value;
                  }),
                )
              }
            />
          </label>
          <label>
            Destination
            <input
              value={campaign.destination}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.campaigns[index].destination = event.target.value;
                  }),
                )
              }
            />
          </label>
          <label>
            Audience
            <select
              value={campaign.audienceId ?? ''}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.campaigns[index].audienceId = event.target.value || null;
                  }),
                )
              }
            >
              <option value="">Everyone</option>
              {manifest.audiences.map((audience) => (
                <option key={audience.id} value={audience.id}>
                  {audience.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={campaign.status}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.campaigns[index].status = event.target.value as typeof campaign.status;
                    if (event.target.value !== 'scheduled')
                      next.campaigns[index].scheduledAt = null;
                  }),
                )
              }
            >
              <option>draft</option>
              <option>ready</option>
              <option>scheduled</option>
            </select>
          </label>
          {campaign.status === 'scheduled' && (
            <label>
              Schedule time
              <input
                type="datetime-local"
                disabled={readOnly}
                value={campaign.scheduledAt?.slice(0, 16) ?? ''}
                onChange={(event) =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      next.campaigns[index].scheduledAt = event.target.value
                        ? new Date(event.target.value).toISOString()
                        : null;
                    }),
                  )
                }
              />
            </label>
          )}
          <button
            disabled={readOnly}
            onClick={() =>
              onChange(updateManifest(manifest, (next) => next.campaigns.splice(index, 1)))
            }
            type="button"
          >
            Delete campaign
          </button>
        </article>
      ))}
    </div>
  );
}
