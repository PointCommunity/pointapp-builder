import { createElement, elementTypes, type AppElement } from '../../content/manifest';
import { useState } from 'react';
import { MediaSelect } from '../components/MediaSelect';
import { newId, updateManifest, type ManifestPanelProps } from './types';

function TextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}
function ElementFields({
  element,
  change,
  readOnly,
}: {
  element: AppElement;
  change: (patch: Partial<AppElement>) => void;
  readOnly: boolean;
}) {
  if (element.type === 'divider')
    return <p className="muted">A visual divider has no content settings.</p>;
  if (element.type === 'spacer')
    return (
      <label>
        Size
        <select
          value={element.size}
          onChange={(event) => change({ size: event.target.value } as Partial<AppElement>)}
        >
          <option>small</option>
          <option>medium</option>
          <option>large</option>
        </select>
      </label>
    );
  if (element.type === 'hero')
    return (
      <>
        <TextField
          label="Eyebrow"
          value={element.eyebrow}
          onChange={(eyebrow) => change({ eyebrow })}
        />
        <TextField label="Title" value={element.title} onChange={(title) => change({ title })} />
        <TextField
          label="Body"
          multiline
          value={element.body}
          onChange={(body) => change({ body })}
        />
        <TextField
          label="Action label"
          value={element.actionLabel}
          onChange={(actionLabel) => change({ actionLabel })}
        />
        <TextField
          label="Action destination"
          value={element.actionDestination}
          onChange={(actionDestination) => change({ actionDestination })}
        />
        <MediaSelect
          label="Hero image"
          kind="image"
          value={element.imageMediaId}
          optional
          disabled={readOnly}
          onChange={(imageMediaId) => change({ imageMediaId })}
        />
      </>
    );
  if (element.type === 'rich-text')
    return (
      <>
        <TextField
          label="Text"
          multiline
          value={element.body}
          onChange={(body) => change({ body })}
        />
        <label>
          Text style
          <select
            value={element.style}
            disabled={readOnly}
            onChange={(event) => change({ style: event.target.value } as Partial<AppElement>)}
          >
            <option>body</option>
            <option>lead</option>
            <option>caption</option>
          </select>
        </label>
      </>
    );
  if (element.type === 'action')
    return (
      <>
        <TextField label="Label" value={element.label} onChange={(label) => change({ label })} />
        <TextField
          label="Destination"
          value={element.destination}
          onChange={(destination) => change({ destination })}
        />
        <label>
          Appearance
          <select
            value={element.appearance}
            disabled={readOnly}
            onChange={(event) => change({ appearance: event.target.value } as Partial<AppElement>)}
          >
            <option>primary</option>
            <option>secondary</option>
            <option>quiet</option>
          </select>
        </label>
      </>
    );
  if (element.type === 'image')
    return (
      <>
        <MediaSelect
          label="Image"
          kind="image"
          value={element.mediaId}
          disabled={readOnly}
          onChange={(mediaId) => mediaId && change({ mediaId } as Partial<AppElement>)}
        />
        <TextField label="Alt text" value={element.alt} onChange={(alt) => change({ alt })} />
        <label>
          Aspect ratio
          <select
            value={element.aspect}
            disabled={readOnly}
            onChange={(event) => change({ aspect: event.target.value } as Partial<AppElement>)}
          >
            <option>square</option>
            <option>portrait</option>
            <option>landscape</option>
            <option>wide</option>
          </select>
        </label>
      </>
    );
  if (element.type === 'video')
    return (
      <>
        <MediaSelect
          label="Video"
          kind="video"
          value={element.mediaId}
          disabled={readOnly}
          onChange={(mediaId) => mediaId && change({ mediaId } as Partial<AppElement>)}
        />
        <TextField label="Title" value={element.title} onChange={(title) => change({ title })} />
      </>
    );
  if (element.type === 'audio')
    return (
      <>
        <MediaSelect
          label="Audio"
          kind="audio"
          value={element.mediaId}
          disabled={readOnly}
          onChange={(mediaId) => mediaId && change({ mediaId } as Partial<AppElement>)}
        />
        <TextField label="Title" value={element.title} onChange={(title) => change({ title })} />
        <TextField
          label="Speaker"
          value={element.speaker}
          onChange={(speaker) => change({ speaker })}
        />
      </>
    );
  if (element.type === 'card-list')
    return (
      <>
        <TextField
          label="Section title"
          value={element.title}
          onChange={(title) => change({ title })}
        />
        {element.cards.map((card, index) => (
          <fieldset key={card.id}>
            <legend>Card {index + 1}</legend>
            <TextField
              label="Card title"
              value={card.title}
              onChange={(title) =>
                change({
                  cards: element.cards.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, title } : item,
                  ),
                } as Partial<AppElement>)
              }
            />
            <TextField
              label="Card body"
              multiline
              value={card.body}
              onChange={(body) =>
                change({
                  cards: element.cards.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, body } : item,
                  ),
                } as Partial<AppElement>)
              }
            />
            <TextField
              label="Card destination"
              value={card.destination}
              onChange={(destination) =>
                change({
                  cards: element.cards.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, destination } : item,
                  ),
                } as Partial<AppElement>)
              }
            />
            <MediaSelect
              label="Card image"
              kind="image"
              value={card.imageMediaId}
              optional
              disabled={readOnly}
              onChange={(imageMediaId) =>
                change({
                  cards: element.cards.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, imageMediaId } : item,
                  ),
                } as Partial<AppElement>)
              }
            />
            <div className="row-actions">
              <button
                type="button"
                disabled={readOnly || index === 0}
                onClick={() => {
                  const cards = structuredClone(element.cards);
                  [cards[index - 1], cards[index]] = [cards[index], cards[index - 1]];
                  change({ cards } as Partial<AppElement>);
                }}
              >
                Move card up
              </button>
              <button
                type="button"
                disabled={readOnly || element.cards.length === 1}
                onClick={() =>
                  change({
                    cards: element.cards.filter((_, itemIndex) => itemIndex !== index),
                  } as Partial<AppElement>)
                }
              >
                Delete card
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={readOnly || element.cards.length >= 20}
          onClick={() =>
            change({
              cards: [
                ...element.cards,
                {
                  id: newId('card'),
                  title: 'New card',
                  body: '',
                  destination: '/',
                  imageMediaId: null,
                },
              ],
            } as Partial<AppElement>)
          }
        >
          Add card
        </button>
      </>
    );
  if (element.type === 'event-list')
    return (
      <>
        <TextField label="Title" value={element.title} onChange={(title) => change({ title })} />
        <TextField
          label="HTTPS event source"
          value={element.sourceUrl}
          onChange={(sourceUrl) => change({ sourceUrl })}
        />
        <label>
          Event limit
          <input
            type="number"
            min={1}
            max={20}
            value={element.limit}
            disabled={readOnly}
            onChange={(event) =>
              change({ limit: Number(event.target.value) } as Partial<AppElement>)
            }
          />
        </label>
      </>
    );
  if (element.type === 'scripture')
    return (
      <>
        <TextField
          label="Reference"
          value={element.reference}
          onChange={(reference) => change({ reference })}
        />
        <TextField
          label="Text"
          multiline
          value={element.text}
          onChange={(text) => change({ text })}
        />
        <TextField
          label="Translation"
          value={element.translation}
          onChange={(translation) => change({ translation })}
        />
      </>
    );
  return (
    <>
      <TextField label="Title" value={element.title} onChange={(title) => change({ title })} />
      <TextField label="HTTPS URL" value={element.url} onChange={(url) => change({ url })} />
      <label>
        Preview height
        <input
          type="number"
          min={180}
          max={900}
          value={element.height}
          disabled={readOnly}
          onChange={(event) =>
            change({ height: Number(event.target.value) } as Partial<AppElement>)
          }
        />
      </label>
    </>
  );
}

export function ContentPanel({ manifest, onChange, readOnly }: ManifestPanelProps) {
  const [screenId, setScreenId] = useState(manifest.screens[0].id);
  const activeIndex = Math.max(
    0,
    manifest.screens.findIndex((screen) => screen.id === screenId),
  );
  const active = manifest.screens[activeIndex];
  const [elementType, setElementType] = useState<(typeof elementTypes)[number]>('rich-text');
  const mutate = (fn: (screen: typeof active) => void) =>
    onChange(updateManifest(manifest, (next) => fn(next.screens[activeIndex])));
  const addScreen = () => {
    const id = newId('screen');
    onChange(
      updateManifest(manifest, (next) =>
        next.screens.push({
          id,
          title: 'New screen',
          slug: newId('page'),
          visible: true,
          audienceIds: [],
          elements: [],
        }),
      ),
    );
    setScreenId(id);
  };
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>Screens & elements</h3>
          <p>Build data-only app experiences with twelve mobile-safe element types.</p>
        </div>
        <button type="button" onClick={addScreen} disabled={readOnly}>
          Add screen
        </button>
      </div>
      <div className="screen-list">
        {manifest.screens.map((screen, index) => (
          <article key={screen.id}>
            <button
              aria-pressed={active.id === screen.id}
              className="screen-selector"
              onClick={() => setScreenId(screen.id)}
              type="button"
            >
              Edit {screen.title}
            </button>
            <label>
              Screen slug
              <input
                value={screen.slug}
                disabled={readOnly}
                onChange={(event) =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      next.screens[index].slug = event.target.value;
                    }),
                  )
                }
              />
            </label>
            <label>
              Screen title
              <input
                value={screen.title}
                disabled={readOnly}
                onChange={(event) =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      next.screens[index].title = event.target.value;
                    }),
                  )
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={screen.visible}
                disabled={
                  readOnly || manifest.navigation.some((item) => item.screenId === screen.id)
                }
                onChange={(event) =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      next.screens[index].visible = event.target.checked;
                    }),
                  )
                }
              />
              Visible
            </label>
            <label>
              Screen audiences
              <select
                multiple
                value={screen.audienceIds}
                disabled={readOnly}
                onChange={(event) =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      next.screens[index].audienceIds = Array.from(
                        event.target.selectedOptions,
                        (option) => option.value,
                      );
                    }),
                  )
                }
              >
                {manifest.audiences.map((audience) => (
                  <option key={audience.id} value={audience.id}>
                    {audience.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row-actions">
              <button
                disabled={readOnly || index === 0}
                onClick={() =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      [next.screens[index - 1], next.screens[index]] = [
                        next.screens[index],
                        next.screens[index - 1],
                      ];
                    }),
                  )
                }
                type="button"
              >
                Move up
              </button>
              <button
                disabled={readOnly || index === manifest.screens.length - 1}
                onClick={() =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      [next.screens[index + 1], next.screens[index]] = [
                        next.screens[index],
                        next.screens[index + 1],
                      ];
                    }),
                  )
                }
                type="button"
              >
                Move down
              </button>
              <button
                disabled={readOnly}
                onClick={() =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      next.screens.splice(index + 1, 0, {
                        ...structuredClone(screen),
                        id: newId('screen'),
                        slug: newId('page'),
                        title: `${screen.title} copy`,
                        elements: screen.elements.map((element) => ({
                          ...element,
                          id: newId(element.type),
                          ...(element.type === 'card-list'
                            ? {
                                cards: element.cards.map((card) => ({
                                  ...card,
                                  id: newId('card'),
                                })),
                              }
                            : {}),
                        })),
                      });
                    }),
                  )
                }
                type="button"
              >
                Duplicate
              </button>
              <button
                disabled={
                  readOnly ||
                  manifest.screens.length === 1 ||
                  manifest.navigation.some((item) => item.screenId === screen.id)
                }
                onClick={() =>
                  onChange(
                    updateManifest(manifest, (next) => {
                      next.screens.splice(index, 1);
                    }),
                  )
                }
                type="button"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="element-add">
        <label>
          Add element
          <select
            value={elementType}
            onChange={(event) => setElementType(event.target.value as typeof elementType)}
          >
            {elementTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <button
          disabled={readOnly}
          onClick={() =>
            mutate((screen) => screen.elements.push(createElement(elementType, newId(elementType))))
          }
          type="button"
        >
          Add to {active.title}
        </button>
      </div>
      <ol className="editor-elements">
        {active.elements.map((element, index) => (
          <li key={element.id}>
            <details open>
              <summary>
                <span>
                  {index + 1}. {element.type}
                </span>
              </summary>
              <fieldset className="element-fields" disabled={readOnly}>
                <legend className="visually-hidden">{element.type} settings</legend>
                <ElementFields
                  element={element}
                  readOnly={readOnly ?? false}
                  change={(patch) =>
                    mutate((screen) => {
                      screen.elements[index] = {
                        ...screen.elements[index],
                        ...patch,
                      } as AppElement;
                    })
                  }
                />
              </fieldset>
              <label>
                Audience visibility
                <select
                  multiple
                  value={element.audienceIds}
                  disabled={readOnly}
                  onChange={(event) =>
                    mutate((screen) => {
                      screen.elements[index].audienceIds = Array.from(
                        event.target.selectedOptions,
                        (option) => option.value,
                      );
                    })
                  }
                >
                  {manifest.audiences.map((audience) => (
                    <option key={audience.id} value={audience.id}>
                      {audience.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Move to screen
                <select
                  value={active.id}
                  disabled={readOnly || manifest.screens.length === 1}
                  onChange={(event) => {
                    const targetId = event.target.value;
                    if (targetId === active.id) return;
                    onChange(
                      updateManifest(manifest, (next) => {
                        const [moved] = next.screens[activeIndex].elements.splice(index, 1);
                        next.screens.find((screen) => screen.id === targetId)?.elements.push(moved);
                      }),
                    );
                  }}
                >
                  {manifest.screens.map((screen) => (
                    <option key={screen.id} value={screen.id}>
                      {screen.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row-actions">
                <button
                  disabled={readOnly || index === 0}
                  onClick={() =>
                    mutate((screen) => {
                      [screen.elements[index - 1], screen.elements[index]] = [
                        screen.elements[index],
                        screen.elements[index - 1],
                      ];
                    })
                  }
                  type="button"
                >
                  Up
                </button>
                <button
                  disabled={readOnly || index === active.elements.length - 1}
                  onClick={() =>
                    mutate((screen) => {
                      [screen.elements[index + 1], screen.elements[index]] = [
                        screen.elements[index],
                        screen.elements[index + 1],
                      ];
                    })
                  }
                  type="button"
                >
                  Down
                </button>
                <button
                  disabled={readOnly}
                  onClick={() =>
                    mutate((screen) =>
                      screen.elements.splice(index + 1, 0, {
                        ...structuredClone(element),
                        id: newId(element.type),
                        ...(element.type === 'card-list'
                          ? {
                              cards: element.cards.map((card) => ({
                                ...card,
                                id: newId('card'),
                              })),
                            }
                          : {}),
                      }),
                    )
                  }
                  type="button"
                >
                  Duplicate
                </button>
                <button
                  disabled={readOnly}
                  onClick={() => mutate((screen) => screen.elements.splice(index, 1))}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
