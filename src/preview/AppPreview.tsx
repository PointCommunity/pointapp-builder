import { CalendarBlank, House, PlayCircle, SquaresFour, UsersThree } from '@phosphor-icons/react';
import { useState, type ComponentType } from 'react';
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
          {element.imageMediaId ? <img src={`/api/media/${element.imageMediaId}`} alt="" /> : null}
          {element.eyebrow && <p className="app-eyebrow">{element.eyebrow}</p>}
          <h2>{element.title}</h2>
          {element.body && <p>{element.body}</p>}
          {element.actionLabel && <button type="button">{element.actionLabel}</button>}
        </section>
      );
    case 'rich-text':
      return <p className={`app-text app-text--${element.style}`}>{element.body}</p>;
    case 'action':
      return (
        <button className={`app-action app-action--${element.appearance}`} type="button">
          {element.label}
        </button>
      );
    case 'image':
      return (
        <img
          className={`app-media app-media--${element.aspect}`}
          src={`/api/media/${element.mediaId}`}
          alt={element.alt}
        />
      );
    case 'video':
      return (
        <div className="app-media">
          ▶ {element.title}
          <small>Ready media · {element.mediaId.slice(0, 8)}</small>
        </div>
      );
    case 'audio':
      return (
        <div className="app-audio">
          ♪ <strong>{element.title}</strong>
          {element.speaker && <span>{element.speaker}</span>}
          <small>Ready media · {element.mediaId.slice(0, 8)}</small>
        </div>
      );
    case 'card-list':
      return (
        <section>
          <h3>{element.title}</h3>
          <div className="app-cards">
            {element.cards.map((card) => (
              <article key={card.id}>
                {card.imageMediaId ? <img src={`/api/media/${card.imageMediaId}`} alt="" /> : null}
                <strong>{card.title}</strong>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>
      );
    case 'event-list':
      return (
        <section className="event-list">
          <h3>{element.title}</h3>
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
    case 'scripture':
      return (
        <blockquote>
          <p>{element.text}</p>
          <cite>
            {element.reference} · {element.translation}
          </cite>
        </blockquote>
      );
    case 'divider':
      return <hr />;
    case 'spacer':
      return <div className={`app-spacer app-spacer--${element.size}`} />;
    case 'embed-link':
      return (
        <section className="app-embed">
          <strong>{element.title}</strong>
          <small>{element.url}</small>
        </section>
      );
  }
}

export function AppPreview({
  device,
  manifest,
  audienceId = null,
}: {
  device: PreviewDevice;
  manifest: AppManifest;
  audienceId?: string | null;
}) {
  const visibleScreens = manifest.screens.filter(
    (screen) =>
      screen.visible &&
      (screen.audienceIds.length === 0 ||
        Boolean(audienceId && screen.audienceIds.includes(audienceId))),
  );
  const firstScreenId =
    manifest.navigation.find((item) => visibleScreens.some((screen) => screen.id === item.screenId))
      ?.screenId ?? visibleScreens[0]?.id;
  const [screenId, setScreenId] = useState(firstScreenId);
  const screen = visibleScreens.find((item) => item.id === screenId) ?? visibleScreens[0];
  return (
    <div className="device-shell" data-device={device} data-testid="app-preview">
      <div className="device-camera" aria-hidden="true" />
      <div
        className="mobile-app"
        style={
          {
            '--app-accent': manifest.theme.accent,
            '--app-background': manifest.theme.background,
            '--app-surface': manifest.theme.surface,
            '--app-text': manifest.theme.text,
          } as React.CSSProperties
        }
      >
        <header className="mobile-header">
          {manifest.theme.logoMediaId ? (
            <img
              className="mobile-mark mobile-mark--image"
              src={`/api/media/${manifest.theme.logoMediaId}`}
              alt={`${manifest.app.name} logo`}
            />
          ) : (
            <span className="mobile-mark" aria-hidden="true">
              P
            </span>
          )}
          <strong>{manifest.app.shortName}</strong>
          <span className="mobile-avatar" aria-hidden="true">
            C
          </span>
        </header>
        <div className="mobile-content">
          {screen ? (
            screen.elements
              .filter(
                (element) =>
                  element.audienceIds.length === 0 ||
                  Boolean(audienceId && element.audienceIds.includes(audienceId)),
              )
              .map((element) => <Element element={element} key={element.id} />)
          ) : (
            <p>No visible screen for this audience.</p>
          )}
        </div>
        <nav className="mobile-tabs" aria-label="PointApp tabs">
          {manifest.navigation
            .filter((item) => visibleScreens.some((screenItem) => screenItem.id === item.screenId))
            .map((item) => {
              const Icon = icons[item.icon];
              const active = item.screenId === screen?.id;
              return (
                <button
                  className={active ? 'is-active' : ''}
                  key={item.id}
                  onClick={() => setScreenId(item.screenId)}
                  type="button"
                >
                  <Icon size={20} weight={active ? 'fill' : 'regular'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>
      </div>
    </div>
  );
}
