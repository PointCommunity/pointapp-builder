import { newId, updateManifest, type ManifestPanelProps } from './types';
export function NavigationPanel({ manifest, onChange, readOnly }: ManifestPanelProps) {
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>Bottom navigation</h3>
          <p>Choose two to five visible screen destinations.</p>
        </div>
        <button
          disabled={readOnly || manifest.navigation.length >= 5}
          onClick={() =>
            onChange(
              updateManifest(manifest, (next) => {
                const target = next.screens.find(
                  (screen) =>
                    screen.visible && !next.navigation.some((item) => item.screenId === screen.id),
                );
                if (target)
                  next.navigation.push({
                    id: newId('nav'),
                    label: target.title.slice(0, 20),
                    icon: 'more',
                    screenId: target.id,
                  });
              }),
            )
          }
          type="button"
        >
          Add tab
        </button>
      </div>
      {manifest.navigation.map((item, index) => (
        <article className="form-card" key={item.id}>
          <label>
            Label
            <input
              maxLength={20}
              value={item.label}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.navigation[index].label = event.target.value;
                  }),
                )
              }
            />
          </label>
          <label>
            Screen
            <select
              value={item.screenId}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.navigation[index].screenId = event.target.value;
                  }),
                )
              }
            >
              {manifest.screens
                .filter((screen) => screen.visible)
                .map((screen) => (
                  <option key={screen.id} value={screen.id}>
                    {screen.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Icon
            <select
              value={item.icon}
              disabled={readOnly}
              onChange={(event) =>
                onChange(
                  updateManifest(manifest, (next) => {
                    next.navigation[index].icon = event.target.value as typeof item.icon;
                  }),
                )
              }
            >
              {['home', 'calendar', 'play', 'people', 'more'].map((icon) => (
                <option key={icon}>{icon}</option>
              ))}
            </select>
          </label>
          <div className="row-actions">
            <button
              disabled={readOnly || index === 0}
              onClick={() =>
                onChange(
                  updateManifest(manifest, (next) => {
                    [next.navigation[index - 1], next.navigation[index]] = [
                      next.navigation[index],
                      next.navigation[index - 1],
                    ];
                  }),
                )
              }
              type="button"
            >
              Up
            </button>
            <button
              disabled={readOnly || index === manifest.navigation.length - 1}
              onClick={() =>
                onChange(
                  updateManifest(manifest, (next) => {
                    [next.navigation[index + 1], next.navigation[index]] = [
                      next.navigation[index],
                      next.navigation[index + 1],
                    ];
                  }),
                )
              }
              type="button"
            >
              Down
            </button>
            <button
              disabled={readOnly || manifest.navigation.length <= 2}
              onClick={() =>
                onChange(updateManifest(manifest, (next) => next.navigation.splice(index, 1)))
              }
              type="button"
            >
              Remove
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
