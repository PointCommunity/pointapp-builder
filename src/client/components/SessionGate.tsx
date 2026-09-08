import type { ReactNode } from 'react';
import type { SessionView } from '../api';

export type { SessionView } from '../api';

export function SessionGate({
  session,
  children,
}: {
  session: SessionView | null;
  children: ReactNode;
}) {
  if (!session) {
    return (
      <main className="access-gate" aria-busy="true">
        <div className="access-card">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <p className="gate-kicker">PointApp Builder</p>
          <h1>Checking your access…</h1>
          <p>Your current Builder membership is being verified.</p>
        </div>
      </main>
    );
  }

  if (session.state === 'active' && session.membership) return children;

  const gateState = session.state === 'active' ? 'unavailable' : session.state;
  const contentByState = {
    'signed-out': {
      title: 'Build the PointApp with your team.',
      body: 'Sign in with GitHub. New accounts begin as Pending Editors until an Owner approves access.',
    },
    pending: {
      title: 'Access request pending',
      body: 'An Owner needs to approve your Editor access. You can return here after approval.',
    },
    disabled: {
      title: 'Access is disabled',
      body: 'Your membership is not active. Contact a PointApp Builder Owner if this is unexpected.',
    },
    unavailable: {
      title: 'Sign-in is temporarily unavailable',
      body: 'The Builder is not fully configured. No protected content has been loaded.',
    },
  };
  const content = contentByState[gateState] ?? contentByState.unavailable;

  return (
    <main className="access-gate">
      <div className="access-card">
        <span className="brand-mark" aria-hidden="true">
          P
        </span>
        <p className="gate-kicker">PointApp Builder</p>
        <h1>{content.title}</h1>
        <p>{content.body}</p>
        {session.membership ? (
          <p className="gate-identity">Signed in as @{session.membership.login}</p>
        ) : null}
        {session.state === 'signed-out' ? (
          <a className="button button--primary gate-action" href="/auth/login">
            Sign in with GitHub
          </a>
        ) : null}
      </div>
    </main>
  );
}
