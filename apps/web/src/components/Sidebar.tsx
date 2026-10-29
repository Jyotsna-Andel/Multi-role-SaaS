'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Permission } from '@/lib/types';
import { useSession } from './SessionProvider';

const NAV: { href: string; label: string; permission: Permission; section?: string }[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'project:read' },
  { href: '/projects', label: 'Projects', permission: 'project:read' },
  { href: '/admin/users', label: 'Users', permission: 'user:manage', section: 'Admin' },
  { href: '/admin/audit', label: 'Audit log', permission: 'audit:read', section: 'Admin' },
];

export function Sidebar() {
  const { user, can } = useSession();
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);
  const items = NAV.filter((n) => can(n.permission));

  async function logout() {
    setLeaving(true);
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/login');
  }

  return (
    <aside className="sidebar">
      <div className="brand">TeamSpace</div>
      <div className="org muted small">{user.org.name}</div>
      {items.map((item, i) => (
        <div key={item.href}>
          {item.section && items[i - 1]?.section !== item.section && <div className="nav-section">{item.section}</div>}
          <Link href={item.href} className={`nav-link${pathname.startsWith(item.href) ? ' active' : ''}`}>
            {item.label}
          </Link>
        </div>
      ))}
      <div className="sidebar-footer">
        <div>
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="row">
            <span className={`badge badge-${user.role}`}>{user.role}</span>
            <span className="muted small">{user.email}</span>
          </div>
        </div>
        <button className="btn btn-sm" onClick={logout} disabled={leaving}>{leaving ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </aside>
  );
}
