import { z } from 'zod';

export const IdentifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/);
const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const HttpsOrAppPathSchema = z
  .string()
  .max(500)
  .refine(
    (value) => value.startsWith('/') || /^https:\/\/[^\s]+$/i.test(value),
    'Use an app path or HTTPS URL',
  );
const AudienceIdsSchema = z.array(IdentifierSchema).max(50).default([]);
const MediaIdSchema = z.uuid();
const ElementBase = { id: IdentifierSchema, audienceIds: AudienceIdsSchema };

const HeroElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('hero'),
  eyebrow: z.string().max(60).default(''),
  title: z.string().min(1).max(100),
  body: z.string().max(500).default(''),
  imageMediaId: MediaIdSchema.nullable().default(null),
  actionLabel: z.string().max(40).default(''),
  actionDestination: HttpsOrAppPathSchema.or(z.literal('')).default(''),
});
const RichTextElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('rich-text'),
  body: z.string().min(1).max(10_000),
  style: z.enum(['body', 'lead', 'caption']).default('body'),
});
const ActionElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('action'),
  label: z.string().min(1).max(40),
  destination: HttpsOrAppPathSchema,
  appearance: z.enum(['primary', 'secondary', 'quiet']).default('primary'),
});
const ImageElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('image'),
  mediaId: MediaIdSchema,
  alt: z.string().min(1).max(500),
  aspect: z.enum(['square', 'portrait', 'landscape', 'wide']).default('landscape'),
});
const VideoElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('video'),
  mediaId: MediaIdSchema,
  title: z.string().min(1).max(120),
});
const AudioElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('audio'),
  mediaId: MediaIdSchema,
  title: z.string().min(1).max(120),
  speaker: z.string().max(120).default(''),
});
const CardListElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('card-list'),
  title: z.string().max(100).default(''),
  cards: z
    .array(
      z.strictObject({
        id: IdentifierSchema,
        title: z.string().min(1).max(100),
        body: z.string().max(280).default(''),
        destination: HttpsOrAppPathSchema,
        imageMediaId: MediaIdSchema.nullable().default(null),
      }),
    )
    .min(1)
    .max(20),
});
const EventListElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('event-list'),
  title: z.string().max(100).default('Upcoming events'),
  sourceUrl: z.url().refine((value) => value.startsWith('https://'), 'Use an HTTPS URL'),
  limit: z.number().int().min(1).max(20).default(6),
});
const ScriptureElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('scripture'),
  reference: z.string().min(1).max(80),
  text: z.string().min(1).max(5_000),
  translation: z.string().min(2).max(20),
});
const DividerElementSchema = z.strictObject({ ...ElementBase, type: z.literal('divider') });
const SpacerElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('spacer'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
});
const EmbedLinkElementSchema = z.strictObject({
  ...ElementBase,
  type: z.literal('embed-link'),
  title: z.string().min(1).max(100),
  url: z.url().refine((value) => value.startsWith('https://'), 'Use an HTTPS URL'),
  height: z.number().int().min(180).max(900).default(420),
});

export const elementTypes = [
  'hero',
  'rich-text',
  'action',
  'image',
  'video',
  'audio',
  'card-list',
  'event-list',
  'scripture',
  'divider',
  'spacer',
  'embed-link',
] as const;

export const AppElementSchema = z.discriminatedUnion('type', [
  HeroElementSchema,
  RichTextElementSchema,
  ActionElementSchema,
  ImageElementSchema,
  VideoElementSchema,
  AudioElementSchema,
  CardListElementSchema,
  EventListElementSchema,
  ScriptureElementSchema,
  DividerElementSchema,
  SpacerElementSchema,
  EmbedLinkElementSchema,
]);

export const AppManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    app: z.strictObject({
      id: IdentifierSchema,
      name: z.string().min(1).max(80),
      shortName: z.string().min(1).max(18),
      tagline: z.string().max(160).default(''),
    }),
    settings: z.strictObject({
      organizationName: z.string().min(1).max(120),
      supportUrl: z.url().refine((value) => value.startsWith('https://')),
      privacyUrl: z.url().refine((value) => value.startsWith('https://')),
      termsUrl: z.url().refine((value) => value.startsWith('https://')),
      locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
      timeZone: z.string().min(1).max(80),
      refreshSeconds: z.number().int().min(30).max(86_400),
      minimumClientContract: z.number().int().min(1).max(100),
    }),
    theme: z.strictObject({
      accent: ColorSchema,
      accentContrast: ColorSchema,
      background: ColorSchema,
      surface: ColorSchema,
      text: ColorSchema,
      muted: ColorSchema,
      logoMediaId: MediaIdSchema.nullable().default(null),
      typographyScale: z.enum(['compact', 'standard', 'large']),
      cornerStyle: z.enum(['square', 'soft', 'round']),
      colorMode: z.enum(['light', 'dark', 'system']),
    }),
    audiences: z
      .array(
        z.strictObject({
          id: IdentifierSchema,
          name: z.string().min(1).max(80),
          description: z.string().max(240).default(''),
        }),
      )
      .max(50),
    screens: z
      .array(
        z.strictObject({
          id: IdentifierSchema,
          title: z.string().min(1).max(80),
          slug: IdentifierSchema,
          visible: z.boolean(),
          audienceIds: AudienceIdsSchema,
          elements: z.array(AppElementSchema).max(100),
        }),
      )
      .min(1)
      .max(100),
    navigation: z
      .array(
        z.strictObject({
          id: IdentifierSchema,
          label: z.string().min(1).max(20),
          icon: z.enum(['home', 'calendar', 'play', 'people', 'more']),
          screenId: IdentifierSchema,
        }),
      )
      .min(2)
      .max(5),
    campaigns: z
      .array(
        z.strictObject({
          id: IdentifierSchema,
          title: z.string().min(1).max(100),
          body: z.string().min(1).max(240),
          destination: HttpsOrAppPathSchema,
          audienceId: IdentifierSchema.nullable().default(null),
          status: z.enum(['draft', 'ready', 'scheduled']),
          scheduledAt: z.iso.datetime().nullable().default(null),
        }),
      )
      .max(100),
  })
  .superRefine((manifest, context) => {
    const screenIds = new Set(manifest.screens.map((screen) => screen.id));
    const visibleScreenIds = new Set(
      manifest.screens.filter((screen) => screen.visible).map((screen) => screen.id),
    );
    const audienceIds = new Set(manifest.audiences.map((audience) => audience.id));
    const identifiers = [
      ...manifest.screens.map((screen) => screen.id),
      ...manifest.audiences.map((audience) => audience.id),
      ...manifest.navigation.map((item) => item.id),
      ...manifest.campaigns.map((campaign) => campaign.id),
      ...manifest.screens.flatMap((screen) => screen.elements.map((element) => element.id)),
      ...manifest.screens.flatMap((screen) =>
        screen.elements.flatMap((element) =>
          element.type === 'card-list' ? element.cards.map((card) => card.id) : [],
        ),
      ),
    ];
    if (new Set(identifiers).size !== identifiers.length) {
      context.addIssue({
        code: 'custom',
        path: [],
        message: 'Identifiers must be globally unique',
      });
    }
    for (const [index, item] of manifest.navigation.entries()) {
      if (!screenIds.has(item.screenId) || !visibleScreenIds.has(item.screenId)) {
        context.addIssue({
          code: 'custom',
          path: ['navigation', index, 'screenId'],
          message: 'Navigation must target an existing visible screen',
        });
      }
    }
    for (const [screenIndex, screen] of manifest.screens.entries()) {
      for (const audienceId of [
        ...screen.audienceIds,
        ...screen.elements.flatMap((element) => element.audienceIds),
      ]) {
        if (!audienceIds.has(audienceId))
          context.addIssue({
            code: 'custom',
            path: ['screens', screenIndex, 'audienceIds'],
            message: 'Unknown audience',
          });
      }
    }
    for (const [index, campaign] of manifest.campaigns.entries()) {
      if (campaign.audienceId && !audienceIds.has(campaign.audienceId))
        context.addIssue({
          code: 'custom',
          path: ['campaigns', index, 'audienceId'],
          message: 'Unknown audience',
        });
      if (campaign.status === 'scheduled' && !campaign.scheduledAt)
        context.addIssue({
          code: 'custom',
          path: ['campaigns', index, 'scheduledAt'],
          message: 'Scheduled campaigns require a time',
        });
    }
  });

export type AppManifest = z.infer<typeof AppManifestSchema>;
export type AppElement = z.infer<typeof AppElementSchema>;
export type AppElementType = (typeof elementTypes)[number];

export const sampleManifest: AppManifest = {
  schemaVersion: 1,
  app: {
    id: 'point-community',
    name: 'Point Community Church',
    shortName: 'Point',
    tagline: 'Find your people. Follow Jesus together.',
  },
  settings: {
    organizationName: 'Point Community Church',
    supportUrl: 'https://pointatx.org/contact',
    privacyUrl: 'https://pointatx.org/privacy',
    termsUrl: 'https://pointatx.org/terms',
    locale: 'en-US',
    timeZone: 'America/Chicago',
    refreshSeconds: 60,
    minimumClientContract: 1,
  },
  theme: {
    accent: '#69d4c5',
    accentContrast: '#071613',
    background: '#081018',
    surface: '#111923',
    text: '#f7fafc',
    muted: '#9eabb8',
    logoMediaId: null,
    typographyScale: 'standard',
    cornerStyle: 'soft',
    colorMode: 'dark',
  },
  audiences: [{ id: 'everyone', name: 'Everyone', description: 'Default public app experience' }],
  screens: [
    {
      id: 'home',
      title: 'Home',
      slug: 'home',
      visible: true,
      audienceIds: [],
      elements: [
        {
          id: 'home-hero',
          type: 'hero',
          audienceIds: [],
          eyebrow: 'Welcome home',
          title: 'Find your people. Follow Jesus together.',
          body: 'Content authored in PointApp Builder and delivered to the app.',
          imageMediaId: null,
          actionLabel: 'Plan a visit',
          actionDestination: '/plan-a-visit',
        },
        {
          id: 'home-intro',
          type: 'rich-text',
          audienceIds: [],
          style: 'lead',
          body: 'Sundays at 10:30 AM in Austin, Texas.',
        },
        {
          id: 'home-action',
          type: 'action',
          audienceIds: [],
          label: 'Watch latest message',
          destination: '/media',
          appearance: 'secondary',
        },
      ],
    },
    {
      id: 'events',
      title: 'Events',
      slug: 'events',
      visible: true,
      audienceIds: [],
      elements: [
        {
          id: 'events-list',
          type: 'event-list',
          audienceIds: [],
          title: 'Upcoming events',
          sourceUrl: 'https://pointatx.org/events.json',
          limit: 6,
        },
      ],
    },
  ],
  navigation: [
    { id: 'nav-home', label: 'Home', icon: 'home', screenId: 'home' },
    { id: 'nav-events', label: 'Events', icon: 'calendar', screenId: 'events' },
  ],
  campaigns: [],
};

export function createElement(type: AppElementType, id: string): AppElement {
  const common = { id, audienceIds: [] as string[] };
  const values: Record<AppElementType, AppElement> = {
    hero: {
      ...common,
      type: 'hero',
      eyebrow: '',
      title: 'New hero',
      body: '',
      imageMediaId: null,
      actionLabel: '',
      actionDestination: '',
    },
    'rich-text': { ...common, type: 'rich-text', body: 'New text', style: 'body' },
    action: {
      ...common,
      type: 'action',
      label: 'Learn more',
      destination: '/',
      appearance: 'primary',
    },
    image: {
      ...common,
      type: 'image',
      mediaId: 'choose-image',
      alt: 'Describe this image',
      aspect: 'landscape',
    },
    video: { ...common, type: 'video', mediaId: 'choose-video', title: 'New video' },
    audio: { ...common, type: 'audio', mediaId: 'choose-audio', title: 'New audio', speaker: '' },
    'card-list': {
      ...common,
      type: 'card-list',
      title: 'Featured',
      cards: [
        { id: `${id}-card`, title: 'New card', body: '', destination: '/', imageMediaId: null },
      ],
    },
    'event-list': {
      ...common,
      type: 'event-list',
      title: 'Upcoming events',
      sourceUrl: 'https://pointatx.org/events.json',
      limit: 6,
    },
    scripture: {
      ...common,
      type: 'scripture',
      reference: 'John 3:16',
      text: 'Enter licensed or original scripture text.',
      translation: 'WEB',
    },
    divider: { ...common, type: 'divider' },
    spacer: { ...common, type: 'spacer', size: 'medium' },
    'embed-link': {
      ...common,
      type: 'embed-link',
      title: 'Embedded page',
      url: 'https://pointatx.org',
      height: 420,
    },
  };
  return values[type];
}
