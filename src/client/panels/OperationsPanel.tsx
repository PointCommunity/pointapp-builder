import { useEffect, useState } from 'react';
import { loadAudit, loadOperations, type AuditView, type OperationsView } from '../api';
export function OperationsPanel() {
  const [operations, setOperations] = useState<OperationsView | null>(null);
  const [audits, setAudits] = useState<AuditView[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    void Promise.all([loadOperations(), loadAudit()])
      .then(([status, history]) => {
        setOperations(status);
        setAudits(history.items);
      })
      .catch(() => setError('Operations data could not be loaded.'));
  }, []);
  if (error)
    return (
      <p className="error-banner" role="alert">
        {error}
      </p>
    );
  if (!operations) return <p role="status">Loading operations…</p>;
  return (
    <div className="panel-stack">
      <div className="panel-heading">
        <div>
          <h3>Operations</h3>
          <p>Owner-only health, capacity, release state, and redacted audit history.</p>
        </div>
      </div>
      <div className="capacity-grid">
        {Object.entries(operations.capacity).map(([name, value]) => (
          <article key={name}>
            <strong>{value}</strong>
            <span>{name}</span>
          </article>
        ))}
      </div>
      <h4>Audit trail</h4>
      <ol className="audit-list">
        {audits.map((item) => (
          <li key={item.id}>
            <span>
              <strong>{item.action}</strong>
              <small>
                {item.outcome} · {item.targetType} · {new Date(item.occurredAt).toLocaleString()}
              </small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
