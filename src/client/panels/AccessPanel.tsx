import { useEffect, useState } from 'react';
import { roles, type Role } from '../../domain/access';
import {
  listMemberships,
  updateMembership as updateMembershipRequest,
  type MembershipUpdate,
  type MembershipView,
} from '../api';

export function AccessPanel({
  actorRole = 'owner',
  initialItems,
  updateMembership = updateMembershipRequest,
}: {
  actorRole?: Role;
  initialItems?: MembershipView[];
  updateMembership?: (githubUserId: string, input: MembershipUpdate) => Promise<MembershipView>;
}) {
  const [items, setItems] = useState(initialItems ?? []);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(initialItems === undefined);

  useEffect(() => {
    if (initialItems) return;
    let current = true;
    void listMemberships()
      .then((page) => current && setItems(page.items))
      .catch(() => current && setMessage('Access requests could not be loaded.'))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [initialItems]);

  function changeRole(githubUserId: string, role: Role) {
    setItems((current) =>
      current.map((item) => (item.githubUserId === githubUserId ? { ...item, role } : item)),
    );
  }

  async function save(item: MembershipView, status: MembershipView['status']) {
    setMessage(`Saving access for @${item.login}…`);
    try {
      const updated = await updateMembership(item.githubUserId, {
        expectedVersion: item.version,
        role: item.role,
        status,
        reason:
          status === 'active'
            ? item.status === 'pending'
              ? 'Approved by access manager'
              : 'Access updated by access manager'
            : 'Disabled by access manager',
      });
      setItems((current) =>
        current.map((candidate) =>
          candidate.githubUserId === updated.githubUserId ? updated : candidate,
        ),
      );
      setMessage(`Access for @${updated.login} is now ${updated.status}.`);
    } catch {
      setMessage(`Access for @${item.login} could not be changed. Reload and try again.`);
    }
  }

  const assignableRoles = actorRole === 'owner' ? roles : roles.slice(0, 2);

  return (
    <div className="access-panel-content">
      <div className="panel-section-heading">
        <div>
          <small>People</small>
          <h3>Access requests</h3>
        </div>
        <span>{items.filter((item) => item.status === 'pending').length} pending</span>
      </div>
      {loading ? <p role="status">Loading access requests…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="empty-state">No access requests need attention.</p>
      ) : null}
      <ul className="membership-list">
        {items.map((item) => (
          <li key={item.githubUserId}>
            <div className="membership-identity">
              <span className="avatar" aria-hidden="true">
                {item.login.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>@{item.login}</strong>
                <small>{item.displayName ?? 'GitHub user'}</small>
              </span>
            </div>
            <span className={`membership-status membership-status--${item.status}`}>
              {item.status.slice(0, 1).toUpperCase() + item.status.slice(1)}
            </span>
            <label>
              <span className="visually-hidden">Role for @{item.login}</span>
              <select
                aria-label={`Role for @${item.login}`}
                value={item.role}
                onChange={(event) => changeRole(item.githubUserId, event.target.value as Role)}
              >
                {assignableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <div className="membership-actions">
              {item.status === 'pending' ? (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void save(item, 'active')}
                >
                  Approve @{item.login}
                </button>
              ) : item.status === 'disabled' ? (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void save(item, 'active')}
                >
                  Reactivate @{item.login}
                </button>
              ) : (
                <>
                  <button
                    className="button"
                    type="button"
                    onClick={() => void save(item, 'active')}
                  >
                    Save @{item.login}
                  </button>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => void save(item, 'disabled')}
                  >
                    Disable @{item.login}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="release-status" role="status">
        {message}
      </p>
    </div>
  );
}
