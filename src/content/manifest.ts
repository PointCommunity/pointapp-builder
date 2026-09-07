import { z } from 'zod';

const Identifier = z.string().regex(/^[a-z][a-z0-9-]*$/);
const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i);
const ElementBase = { id: Identifier };

const HeroElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('hero'),
  eyebrow: z.string().max(60).optional(),
  title: z.string().min(1).max(100),
  body: z.string().max(280).optional(),
  action: z
    .strictObject({ label: z.string().min(1).max(40), href: z.string().min(1).max(500) })
    .optional(),
});

const TextElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('text'),
  body: z.string().min(1).max(4_000),
  style: z.enum(['body', 'lead', 'caption']).default('body'),
});

const ActionElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('action'),
  label: z.string().min(1).max(40),
  href: z.string().min(1).max(500),
  appearance: z.enum(['primary', 'secondary', 'quiet']).default('primary'),
});

const MediaElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('media'),
  assetId: Identifier,
  alt: z.string().min(1).max(240),
  aspect: z.enum(['square', 'portrait', 'landscape', 'wide']).default('landscape'),
});

const EventListElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('event-list'),
  sourceId: Identifier,
  limit: z.number().int().min(1).max(20).default(6),
});

const DividerElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('divider'),
});

export const AppElementSchema = z.discriminatedUnion('type', [
  HeroElementSchema,
  TextElementSchema,
  ActionElementSchema,
  MediaElementSchema,
  EventListElementSchema,
  DividerElementSchema,
]);

const AppManifestBaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  appId: Identifier,
  revision: z.number().int().positive(),
  channel: z.enum(['draft', 'staging', 'production']),
  updatedAt: z.iso.datetime(),
  brand: z.strictObject({
    name: z.string().min(1).max(80),
    shortName: z.string().min(1).max(18),
    accent: HexColor,
    surface: HexColor,
  }),
  navigation: z
    .array(
      z.strictObject({
        id: Identifier,
        label: z.string().min(1).max(20),
        icon: z.enum(['home', 'calendar', 'play', 'people', 'more']),
        screenId: Identifier,
      }),
    )
    .min(2)
    .max(5),
  screens: z
    .array(
      z.strictObject({
        id: Identifier,
        title: z.string().min(1).max(80),
        elements: z.array(AppElementSchema).max(100),
      }),
    )
    .min(1),
  assets: z.array(
    z.strictObject({
      id: Identifier,
      kind: z.enum(['image', 'audio', 'video']),
      url: z.url(),
      alt: z.string().max(240).optional(),
    }),
  ),
});

export const AppManifestSchema = AppManifestBaseSchema.superRefine((manifest, context) => {
  const screenIds = new Set(manifest.screens.map((screen) => screen.id));
  for (const [index, item] of manifest.navigation.entries()) {
    if (!screenIds.has(item.screenId)) {
      context.addIssue({
        code: 'custom',
        path: ['navigation', index, 'screenId'],
        message: 'Navigation must target an existing screen',
      });
    }
  }

  const elementIds = manifest.screens.flatMap((screen) =>
    screen.elements.map((element) => element.id),
  );
  if (new Set(elementIds).size !== elementIds.length) {
    context.addIssue({
      code: 'custom',
      path: ['screens'],
      message: 'Element identifiers must be unique across the manifest',
    });
  }
});

export type AppManifest = z.infer<typeof AppManifestSchema>;
export type AppElement = z.infer<typeof AppElementSchema>;

export const sampleManifest: AppManifest = {
  schemaVersion: 1,
  appId: 'point-community',
  revision: 1,
  channel: 'draft',
  updatedAt: '2026-09-07T12:00:00.000Z',
  brand: {
    name: 'Point Community Church',
    shortName: 'Point',
    accent: '#69d4c5',
    surface: '#111923',
  },
  navigation: [
    { id: 'nav-home', label: 'Home', icon: 'home', screenId: 'home' },
    { id: 'nav-events', label: 'Events', icon: 'calendar', screenId: 'events' },
    { id: 'nav-media', label: 'Media', icon: 'play', screenId: 'media' },
    { id: 'nav-connect', label: 'Connect', icon: 'people', screenId: 'connect' },
  ],
  screens: [
    {
      id: 'home',
      title: 'Home',
      elements: [
        {
          id: 'home-hero',
          type: 'hero',
          eyebrow: 'Welcome home',
          title: 'Find your people. Follow Jesus together.',
          body: 'A first look at content flowing from PointApp Builder into the mobile experience.',
          action: { label: 'Plan a visit', href: '/plan-a-visit' },
        },
        {
          id: 'home-intro',
          type: 'text',
          style: 'lead',
          body: 'Sundays at 10:30 AM in Austin, Texas.',
        },
        {
          id: 'home-action',
          type: 'action',
          label: 'Watch latest message',
          href: '/media/latest',
          appearance: 'secondary',
        },
      ],
    },
    {
      id: 'events',
      title: 'Events',
      elements: [{ id: 'events-list', type: 'event-list', sourceId: 'point-events', limit: 6 }],
    },
    {
      id: 'media',
      title: 'Media',
      elements: [
        {
          id: 'media-intro',
          type: 'text',
          style: 'body',
          body: 'Messages and conversations from Point.',
        },
      ],
    },
    {
      id: 'connect',
      title: 'Connect',
      elements: [
        {
          id: 'connect-action',
          type: 'action',
          label: 'Join a group',
          href: '/groups',
          appearance: 'primary',
        },
      ],
    },
  ],
  assets: [],
};
