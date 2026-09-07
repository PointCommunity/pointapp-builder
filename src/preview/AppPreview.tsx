import { CalendarBlank, House, PlayCircle, SquaresFour, UsersThree } from '@phosphor-icons/react';
import type { ComponentType } from 'react';
import type { AppElement, AppManifest } from '../content/manifest';

export type PreviewDevice = 'phone' | 'tablet';

const icons: Record<
  AppManifest['navigation'][number]['icon'],
  ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>
> = {
  home: House,
  calendar: CalendarBlank,
  play: PlayCircle,
  people: UsersThree,
  more: SquaresFour,
};

function Element({ element }: { element: AppElement }) {
  switch (element.type) {
    case 'hero':
      return (
        <section className="app-hero">
          {element.eyebrow ? <p className="app-eyebrow">{element.eyebrow}</p> : null}
          <h2>{element.title}</h2>
          {element.body ? <p>{element.body}</p> : null}
          {element.action ? <button type="button">{element.action.label}</button> : null}
        </section>
      );
    case 'text':
      return <p className={`app-text app-text--${element.style}`}>{element.body}</p>;
    case 'action':
      return (
        <button className={`app-action app-action--${element.appearance}`} type="button">
          {element.label}
        </button>
      );
    case 'media':
      return <div className={`app-media app-media--${element.aspect}`}>{element.alt}</div>;
    case 'event-list':
      return (
        <section className="event-list">
          <div>
            <time>SEP 14</time>
            <span>Point Welcome Lunch</span>
          </div>
          <div>
            <time>SEP 18</time>
            <span>Community Groups</span>
          </div>
        </section>
      );
    case 'divider':
      return <hr />;
  }
}

export function AppPreview({ device, manifest }: { device: PreviewDevice; manifest: AppManifest }) {
  const screen = manifest.screens.find((item) => item.id === manifest.navigation[0].screenId);

  return (
    <div className="device-shell" data-device={device} data-testid="app-preview">
      <div className="device-camera" aria-hidden="true" />
      <div
        className="mobile-app"
        style={{ '--app-accent': manifest.brand.accent } as React.CSSProperties}
      >
        <header className="mobile-header">
          <span className="mobile-mark" aria-hidden="true">
            P
          </span>
          <strong>{manifest.brand.shortName}</strong>
          <span className="mobile-avatar" aria-hidden="true">
            C
          </span>
        </header>
        <div className="mobile-content">
          {screen?.elements.map((element) => (
            <Element element={element} key={element.id} />
          ))}
        </div>
        <nav className="mobile-tabs" aria-label="PointApp tabs">
          {manifest.navigation.map((item, index) => {
            const Icon = icons[item.icon];
            return (
              <button className={index === 0 ? 'is-active' : ''} key={item.id} type="button">
                <Icon size={20} weight={index === 0 ? 'fill' : 'regular'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
