import {
  Bell,
  CaretRight,
  CirclesFour,
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
import { useState, type ComponentType } from 'react';
import { sampleManifest } from '../content/manifest';
import { can, roles, type Role } from '../domain/access';
import { AppPreview, type PreviewDevice } from '../preview/AppPreview';

type Panel =
  | 'Content'
  | 'Library'
  | 'Navigation'
  | 'Branding'
  | 'Audience'
  | 'Notifications'
  | 'Releases'
  | 'Access'
  | 'Settings';

const panels: Array<{
  label: Panel;
  icon: ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>;
}> = [
  { label: 'Content', icon: Layout },
  { label: 'Library', icon: Images },
  { label: 'Navigation', icon: List },
  { label: 'Branding', icon: PaintBrush },
  { label: 'Audience', icon: Users },
  { label: 'Notifications', icon: Bell },
  { label: 'Releases', icon: RocketLaunch },
  { label: 'Access', icon: LockKey },
  { label: 'Settings', icon: Gear },
];

const panelDescriptions: Record<Panel, string> = {
  Content: 'Arrange screens and mobile-native content elements.',
  Library: 'Manage approved images, audio, video, and metadata.',
  Navigation: 'Shape phone and tablet tabs without changing app code.',
  Branding: 'Control approved colors, typography, icons, and presentation tokens.',
  Audience: 'Prepare targeted content rules without exposing private member data.',
  Notifications: 'Draft and schedule governed push-notification campaigns.',
  Releases: 'Move one immutable content revision through Staging and Production.',
  Access: 'Assign Editor, Publisher, Administrator, and Owner responsibilities.',
  Settings: 'Manage organization-level PointApp Builder configuration.',
};

function ContentInspector() {
  const elements = sampleManifest.screens[0].elements;
  return (
    <ol className="element-list">
      {elements.map((element, index) => (
        <li key={element.id}>
          <button type="button">
            <span className="drag-handle" aria-hidden="true">
              ••
            </span>
            <span>
              <small>{String(index + 1).padStart(2, '0')}</small>
              {element.type.replace('-', ' ')}
            </span>
            <CaretRight size={16} />
          </button>
        </li>
      ))}
    </ol>
  );
}

function ReleaseInspector({ role }: { role: Role }) {
  const [status, setStatus] = useState('No release service is connected in foundation mode.');
  return (
    <div className="release-stack">
      <div className="release-card">
        <span className="status-dot status-dot--draft" />
        <div>
          <small>Draft</small>
          <strong>Revision {sampleManifest.revision}</strong>
        </div>
      </div>
      <div className="release-card">
        <span className="status-dot" />
        <div>
          <small>Staging</small>
          <strong>Not published</strong>
        </div>
      </div>
      <button
        className="button button--primary"
        disabled={!can(role, 'staging:publish')}
        onClick={() => setStatus('Staging publish is intentionally disconnected.')}
        type="button"
      >
        Publish to Staging
      </button>
      <button
        className="button"
        disabled={!can(role, 'production:promote')}
        onClick={() => setStatus('Production promotion is intentionally disconnected.')}
        type="button"
      >
        Promote Staging to Production
      </button>
      <p className="release-status" role="status">
        {status}
      </p>
    </div>
  );
}

function Inspector({ panel, role }: { panel: Panel; role: Role }) {
  return (
    <aside className="inspector" aria-labelledby="panel-title">
      <div className="inspector-heading">
        <p>Workspace panel</p>
        <h2 id="panel-title">{panel}</h2>
        <span>Foundation</span>
      </div>
      <p className="panel-description">{panelDescriptions[panel]}</p>
      {panel === 'Content' ? <ContentInspector /> : null}
      {panel === 'Releases' ? <ReleaseInspector role={role} /> : null}
      {panel !== 'Content' && panel !== 'Releases' ? (
        <div className="future-panel">
          <CirclesFour size={26} />
          <strong>Bounded for a later slice</strong>
          <p>This panel has its own contract and will not be mixed into the foundation commit.</p>
        </div>
      ) : null}
    </aside>
  );
}

export function App() {
  const [panel, setPanel] = useState<Panel>('Content');
  const [device, setDevice] = useState<PreviewDevice>('phone');
  const [role, setRole] = useState<Role>('editor');

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
            <span /> Foundation
          </span>
          <span>Home</span>
          <span className="muted">Revision {sampleManifest.revision}</span>
        </div>
        <div className="identity">
          <label htmlFor="foundation-role">Foundation role</label>
          <select
            id="foundation-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <span className="avatar" aria-hidden="true">
            C
          </span>
        </div>
      </header>

      <div className="workspace">
        <nav className="builder-nav" aria-label="Builder panels">
          <div className="nav-group-title">Build</div>
          {panels.slice(0, 6).map(({ label, icon: Icon }) => (
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
          <div className="nav-group-title">Govern</div>
          {panels.slice(6).map(({ label, icon: Icon }) => (
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
          <div className="foundation-lock">
            <ShieldCheck size={18} />
            <span>Data disconnected</span>
          </div>
        </nav>

        <main className="stage" id="main-content">
          <div className="stage-toolbar">
            <div>
              <p>Staging canvas</p>
              <h1>{sampleManifest.screens[0].title}</h1>
            </div>
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
          <div className="canvas-grid" aria-hidden="true" />
          <AppPreview device={device} manifest={sampleManifest} />
          <div className="canvas-caption">
            <Megaphone size={16} /> Same manifest contract for web staging and installed apps
          </div>
        </main>

        <Inspector panel={panel} role={role} />
      </div>
    </div>
  );
}
