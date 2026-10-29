import Link from 'next/link';
import { getMe } from '@/lib/server-api';

// Server-side guard: non-admins never receive admin pages (or their JS) at all.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me.permissions.includes('user:manage')) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>Not authorized</h1>
        <p className="muted">
          The admin area requires the <span className="mono">user:manage</span> permission. Your role is{' '}
          <span className={`badge badge-${me.role}`}>{me.role}</span>.
        </p>
        <Link className="btn" href="/dashboard">Back to dashboard</Link>
      </div>
    );
  }
  return children;
}
