'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AuditEntry, CursorPage } from '@/lib/types';

const FILTERS = [
  { value: '', label: 'All events' },
  { value: 'auth.', label: 'Authentication' },
  { value: 'user.', label: 'User management' },
  { value: 'project.', label: 'Projects' },
  { value: 'access.', label: 'Access denied' },
];

// Security-relevant actions get highlighted.
const ALERT_ACTIONS = new Set(['auth.login_failed', 'auth.account_locked', 'auth.login_blocked', 'auth.refresh_reuse_detected', 'access.denied', 'user.deactivated']);

export function AuditLogView() {
  const [action, setAction] = useState('');
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (after: string | null, reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ limit: '20', ...(after ? { cursor: after } : {}), ...(action ? { action } : {}) });
        const page = await api<CursorPage<AuditEntry>>(`/audit-logs?${qs}`);
        setRows((prev) => (reset ? page.data : [...prev, ...page.data]));
        setCursor(page.nextCursor);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  useEffect(() => {
    void load(null, true);
  }, [load]);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 14 }}>
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter events">
          {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button className="btn" onClick={() => load(null, true)} disabled={loading}>Refresh</button>
        <span className="muted small">Cursor pagination: each page continues after the last row you saw.</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Details</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleString()}</td>
                <td>
                  <span className={`badge${ALERT_ACTIONS.has(r.action) ? ' badge-ARCHIVED' : ''}`}>{r.action}</span>
                </td>
                <td>{r.actor ? <><div>{r.actor.name}</div><div className="muted small">{r.actor.email}</div></> : <span className="muted">system</span>}</td>
                <td className="small">
                  {r.entity}
                  {r.entityId && <div className="mono muted">{r.entityId.length > 20 ? `${r.entityId.slice(0, 8)}…` : r.entityId}</div>}
                </td>
                <td className="mono muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.metadata ? JSON.stringify(r.metadata) : ''}>
                  {r.metadata ? JSON.stringify(r.metadata) : '—'}
                </td>
                <td className="mono muted">{r.ip ?? '—'}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>No events.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="muted small">{rows.length} events loaded</span>
        {cursor ? (
          <button className="btn btn-sm" onClick={() => load(cursor, false)} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</button>
        ) : (
          <span className="muted small">{loading ? 'Loading…' : 'End of log'}</span>
        )}
      </div>
    </div>
  );
}
