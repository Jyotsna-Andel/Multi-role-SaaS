import type { Metadata } from 'next';
import { getMe, serverApi } from '@/lib/server-api';
import { PROJECT_STATUSES, type DashboardStats, type Permission } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'project:read', label: 'View projects' },
  { key: 'project:write', label: 'Create & edit projects' },
  { key: 'project:delete', label: 'Delete projects' },
  { key: 'user:read', label: 'View team members' },
  { key: 'user:manage', label: 'Invite & manage users' },
  { key: 'audit:read', label: 'Read audit log' },
];

export default async function DashboardPage() {
  // Both requests run in parallel on the server, with the user's cookies forwarded.
  const [stats, me] = await Promise.all([serverApi<DashboardStats>('/dashboard/stats'), getMe()]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome, {me.name.split(' ')[0]}</h1>
          <div className="muted">{me.org.name} overview</div>
        </div>
        <div className="row small muted">
          Redis cache <span className={`badge badge-${stats.cache}`}>{stats.cache}</span>
          generated {new Date(stats.generatedAt).toLocaleTimeString()}
        </div>
      </div>

      <div className="grid stats">
        <Stat label="Total projects" value={stats.totalProjects} />
        <Stat label="Active users" value={stats.activeUsers} />
        <Stat label="Audit events (24h)" value={stats.auditEvents24h} />
        <Stat label="Active projects" value={stats.projectsByStatus.ACTIVE ?? 0} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginTop: 16 }}>
        <section className="card">
          <h2>Projects by status</h2>
          <div className="stack">
            {PROJECT_STATUSES.map((s) => {
              const count = stats.projectsByStatus[s] ?? 0;
              const pct = stats.totalProjects ? Math.round((count / stats.totalProjects) * 100) : 0;
              return (
                <div key={s}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className={`badge badge-${s}`}>{s.replace('_', ' ')}</span>
                    <span className="small muted">{count} · {pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 999, marginTop: 6 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>
            Your role <span className={`badge badge-${me.role}`}>{me.role}</span>
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
            {ALL_PERMISSIONS.map((p) => {
              const ok = me.permissions.includes(p.key);
              return (
                <li key={p.key} className="row" style={{ justifyContent: 'space-between', opacity: ok ? 1 : 0.5 }}>
                  <span>{ok ? '✓' : '✕'} {p.label}</span>
                  <span className="mono muted">{p.key}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
