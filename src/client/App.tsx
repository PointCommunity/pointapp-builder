import {
  Bell,
  ChartBar,
  DeviceMobile,
  DeviceTablet,
  Gear,
  Images,
  Layout,
  List,
  LockKey,
  Megaphone,
  PaintBrush,
  RocketLaunch,
  ShieldCheck,
  Users,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { can } from '../domain/access';
import { sampleManifest, type AppManifest } from '../content/manifest';
import { AppPreview, type PreviewDevice } from '../preview/AppPreview';
import {
  createDraft,
  listDrafts,
  listRevisions,
  loadSession,
  saveRevision,
  signOut,
  updateDraft,
  type DraftView,
  type RevisionView,
  type SessionView,
} from './api';
import { DraftBar } from './components/DraftBar';
import { SessionGate } from './components/SessionGate';
import { AccessPanel } from './panels/AccessPanel';
import { AudiencePanel } from './panels/AudiencePanel';
import { BrandingPanel } from './panels/BrandingPanel';
import { ContentPanel } from './panels/ContentPanel';
import { LibraryPanel } from './panels/LibraryPanel';
import { NavigationPanel } from './panels/NavigationPanel';
import { NotificationsPanel } from './panels/NotificationsPanel';
import { OperationsPanel } from './panels/OperationsPanel';
import { ReleasesPanel } from './panels/ReleasesPanel';
import { SettingsPanel } from './panels/SettingsPanel';

type Panel =
  | 'Content'
  | 'Library'
  | 'Navigation'
  | 'Branding'
  | 'Audience'
  | 'Notifications'
  | 'Releases'
  | 'Access'
  | 'Settings'
  | 'Operations';
const panels: Array<{
  label: Panel;
  group: 'Build' | 'Govern';
  icon: ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>;
}> = [
  { label: 'Content', group: 'Build', icon: Layout },
  { label: 'Library', group: 'Build', icon: Images },
  { label: 'Navigation', group: 'Build', icon: List },
  { label: 'Branding', group: 'Build', icon: PaintBrush },
  { label: 'Audience', group: 'Build', icon: Users },
  { label: 'Notifications', group: 'Build', icon: Bell },
  { label: 'Releases', group: 'Govern', icon: RocketLaunch },
  { label: 'Access', group: 'Govern', icon: LockKey },
  { label: 'Settings', group: 'Govern', icon: Gear },
  { label: 'Operations', group: 'Govern', icon: ChartBar },
];

function Workspace({
  session,
}: {
  session: SessionView & { membership: NonNullable<SessionView['membership']> };
}) {
  const [panel, setPanel] = useState<Panel>('Content');
  const [device, setDevice] = useState<PreviewDevice>('phone');
  const [drafts, setDrafts] = useState<DraftView[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [manifest, setManifest] = useState<AppManifest>(structuredClone(sampleManifest));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revisions, setRevisions] = useState<RevisionView[]>([]);
  const [message, setMessage] = useState('');
  const [audienceId, setAudienceId] = useState<string | null>(null);
  const membership = session.membership;

  const refreshDrafts = async (selectId?: string) => {
    const page = await listDrafts(true);
    setDrafts(page.items);
    const rememberedId = window.localStorage.getItem('pointapp-builder:draft');
    const chosen =
      page.items.find((item) => item.id === (selectId ?? draft?.id ?? rememberedId)) ??
      page.items.find((item) => item.state === 'active') ??
      page.items[0] ??
      null;
    setDraft(chosen);
    if (chosen) {
      window.localStorage.setItem('pointapp-builder:draft', chosen.id);
      setManifest(structuredClone(chosen.manifest));
      setRevisions((await listRevisions(chosen.id)).items);
    }
    setDirty(false);
  };
  useEffect(() => {
    let active = true;
    void listDrafts(true)
      .then(async (page) => {
        if (!active) return;
        setDrafts(page.items);
        const rememberedId = window.localStorage.getItem('pointapp-builder:draft');
        const chosen =
          page.items.find((item) => item.id === rememberedId) ??
          page.items.find((item) => item.state === 'active') ??
          page.items[0] ??
          null;
        setDraft(chosen);
        if (chosen) {
          window.localStorage.setItem('pointapp-builder:draft', chosen.id);
          setManifest(structuredClone(chosen.manifest));
          setRevisions((await listRevisions(chosen.id)).items);
        }
      })
      .catch(() => setMessage('Drafts could not be loaded.'))
      .finally(() => {
        if (active) setDraftsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const visiblePanels = useMemo(
    () =>
      panels
        .filter(({ label }) => label !== 'Access' || can(membership, 'access:read'))
        .filter(({ label }) => label !== 'Operations' || can(membership, 'operations:read')),
    [membership],
  );
  const changeManifest = (next: AppManifest) => {
    setManifest(next);
    setDirty(true);
    setMessage('Unsaved changes');
  };
  const selectDraft = async (id: string) => {
    if (dirty && !confirm('Discard unsaved changes and switch drafts?')) return;
    await refreshDrafts(id);
  };
  const create = async (name: string, duplicateRevisionId?: string) => {
    setMessage('');
    try {
      const created = await createDraft(name, duplicateRevisionId);
      await refreshDrafts(created.id);
      setMessage('Draft created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft could not be created.');
    }
  };
  const save = async (label: string) => {
    if (!draft) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = await saveRevision(draft, manifest, label);
      await refreshDrafts(saved.id);
      setMessage(`Revision ${saved.currentRevision.sequence} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };
  const mutateDraft = async (change: { name?: string; state?: 'active' | 'archived' }) => {
    if (!draft) return;
    try {
      const updated = await updateDraft(draft, change);
      await refreshDrafts(updated.id);
      setMessage('Draft updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft update failed.');
    }
  };
  const readOnly = !can(membership, 'draft:write') || draft?.state === 'archived';

  let inspector: React.ReactNode;
  const props = { manifest, onChange: changeManifest, readOnly };
  if (panel === 'Content') inspector = <ContentPanel {...props} />;
  else if (panel === 'Library')
    inspector = <LibraryPanel readOnly={!can(membership, 'asset:manage')} />;
  else if (panel === 'Navigation') inspector = <NavigationPanel {...props} />;
  else if (panel === 'Branding') inspector = <BrandingPanel {...props} />;
  else if (panel === 'Audience') inspector = <AudiencePanel {...props} />;
  else if (panel === 'Notifications') inspector = <NotificationsPanel {...props} />;
  else if (panel === 'Releases') inspector = <ReleasesPanel draft={draft} authority={membership} />;
  else if (panel === 'Access') inspector = <AccessPanel actorRole={membership.role} />;
  else if (panel === 'Operations') inspector = <OperationsPanel />;
  else
    inspector = (
      <SettingsPanel {...props} readOnly={readOnly || !can(membership, 'settings:manage')} />
    );

  return (
    <div className="builder-app">
      <a className="skip-link" href="#main-content">
        Skip to preview
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <div>
            <strong>PointApp</strong>
            <span>Builder</span>
          </div>
        </div>
        <div className="project-state">
          <span className="state-pill">
            <span /> Builder Production
          </span>
          <span>{draft?.name ?? 'No draft selected'}</span>
          <span className="muted">
            {draft ? `Revision ${draft.currentRevision.sequence}` : 'Create a draft'}
          </span>
        </div>
        <div className="identity">
          <span className="identity-copy">
            <strong>@{membership.login}</strong>
            <small>{membership.role}</small>
          </span>
          <span className="avatar" aria-hidden="true">
            {(membership.displayName ?? membership.login).slice(0, 1).toUpperCase()}
          </span>
          <button
            className="button identity-signout"
            type="button"
            onClick={() => void signOut().then(() => window.location.reload())}
          >
            Sign out
          </button>
        </div>
      </header>
      <DraftBar
        loading={draftsLoading}
        drafts={drafts}
        draft={draft}
        dirty={dirty}
        saving={saving}
        revisions={revisions}
        onSelect={(id) => void selectDraft(id)}
        onCreate={(name) => create(name)}
        onDuplicate={() => create(`${draft?.name ?? 'Draft'} copy`, draft?.currentRevision.id)}
        onSave={save}
        onRename={(name) => mutateDraft({ name })}
        onArchive={() => mutateDraft({ state: 'archived' })}
        onRecover={() => mutateDraft({ state: 'active' })}
      />
      {message && (
        <p className="global-status" role="status">
          {message}
        </p>
      )}
      <div className="workspace">
        <nav className="builder-nav" aria-label="Builder panels">
          {(['Build', 'Govern'] as const).map((group) => (
            <div className="nav-section" key={group}>
              <div className="nav-group-title">{group}</div>
              {visiblePanels
                .filter((item) => item.group === group)
                .map(({ label, icon: Icon }) => (
                  <button
                    aria-current={panel === label ? 'page' : undefined}
                    key={label}
                    onClick={() => setPanel(label)}
                    type="button"
                  >
                    <Icon size={20} weight={panel === label ? 'fill' : 'regular'} />
                    <span>{label}</span>
                  </button>
                ))}
            </div>
          ))}
          <div className="foundation-lock">
            <ShieldCheck size={18} />
            <span>Server-enforced access</span>
          </div>
        </nav>
        <main className="stage" id="main-content">
          <div className="stage-toolbar">
            <div>
              <p>PointApp staging preview</p>
              <h1>{manifest.screens[0]?.title ?? 'PointApp'}</h1>
            </div>
            <div className="preview-controls">
              <label>
                Audience
                <select
                  value={audienceId ?? ''}
                  onChange={(event) => setAudienceId(event.target.value || null)}
                >
                  <option value="">Everyone</option>
                  {manifest.audiences.map((audience) => (
                    <option key={audience.id} value={audience.id}>
                      {audience.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="device-toggle" aria-label="Preview device">
                <button
                  aria-pressed={device === 'phone'}
                  aria-label="Phone preview"
                  onClick={() => setDevice('phone')}
                  type="button"
                >
                  <DeviceMobile size={18} /> Phone
                </button>
                <button
                  aria-pressed={device === 'tablet'}
                  aria-label="Tablet preview"
                  onClick={() => setDevice('tablet')}
                  type="button"
                >
                  <DeviceTablet size={18} /> Tablet
                </button>
              </div>
            </div>
          </div>
          <div className="canvas-grid" aria-hidden="true" />
          <AppPreview device={device} manifest={manifest} audienceId={audienceId} />
          <div className="canvas-caption">
            <Megaphone size={16} /> Same manifest contract for this preview and installed apps
          </div>
        </main>
        <aside className="inspector" aria-labelledby="panel-title">
          <div className="inspector-heading">
            <p>Workspace panel</p>
            <h2 id="panel-title">{panel}</h2>
            <span>{readOnly ? 'Read only' : dirty ? 'Unsaved' : 'Saved'}</span>
          </div>
          {!draft &&
          panel !== 'Access' &&
          panel !== 'Operations' &&
          panel !== 'Releases' &&
          panel !== 'Library' ? (
            <p className="empty-state">Create or select a draft to persist changes.</p>
          ) : (
            inspector
          )}
        </aside>
      </div>
    </div>
  );
}

export function App({ initialSession }: { initialSession?: SessionView } = {}) {
  const [session, setSession] = useState<SessionView | null>(initialSession ?? null);
  useEffect(() => {
    if (initialSession) return;
    const controller = new AbortController();
    void loadSession(controller.signal)
      .then(setSession)
      .catch(() => setSession({ state: 'unavailable', membership: null, capabilities: [] }));
    return () => controller.abort();
  }, [initialSession]);
  return (
    <SessionGate session={session}>
      {session?.state === 'active' && session.membership ? (
        <Workspace session={{ ...session, membership: session.membership }} />
      ) : null}
    </SessionGate>
  );
}
