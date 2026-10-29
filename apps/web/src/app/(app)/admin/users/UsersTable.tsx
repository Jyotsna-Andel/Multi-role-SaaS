'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useSession } from '@/components/SessionProvider';
import { api, json } from '@/lib/api';
import { ROLES, type OrgUser, type Role } from '@/lib/types';

export function UsersTable({ users }: { users: OrgUser[] }) {
  const { user: me } = useSession();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  async function mutate(u: OrgUser, path: string, body: unknown, success: string) {
    setBusyId(u.id);
    setMessage(null);
    try {
      await api(`/users/${u.id}/${path}`, { method: 'PATCH', body: json(body) });
      setMessage({ type: 'success', text: success });
      router.refresh();
    } catch (err) {
      // e.g. 409 "Organization must keep at least one active admin"
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {message && <div className={`alert alert-${message.type}`} style={{ marginBottom: 12 }}>{message.text}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th style={{ textAlign: 'right' }}>Access</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
              return (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.6 }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name} {u.id === me.id && <span className="muted small">(you)</span>}</div>
                    <div className="muted small">{u.email}</div>
                  </td>
                  <td>
                    <select
                      className="select"
                      value={u.role}
                      disabled={busyId === u.id || !u.isActive}
                      onChange={(e) => mutate(u, 'role', { role: e.target.value as Role }, `${u.name} is now ${e.target.value}`)}
                      aria-label={`Role for ${u.name}`}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    {!u.isActive ? <span className="badge badge-inactive">Deactivated</span> : locked ? <span className="badge badge-ON_HOLD">Locked</span> : <span className="badge badge-ACTIVE">Active</span>}
                  </td>
                  <td className="muted small">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {u.id !== me.id && (
                      <button
                        className={`btn btn-sm${u.isActive ? ' btn-danger' : ''}`}
                        disabled={busyId === u.id}
                        onClick={() => mutate(u, 'status', { isActive: !u.isActive }, `${u.name} ${u.isActive ? 'deactivated — signed out everywhere' : 'reactivated'}`)}
                      >
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function InviteButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invited, setInvited] = useState<{ email: string; tempPassword: string } | null>(null);

  function close() {
    setOpen(false);
    setInvited(null);
    setError(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ user: { email: string }; tempPassword: string }>('/users', { method: 'POST', body: json(data) });
      setInvited({ email: res.user.email, tempPassword: res.tempPassword });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Invite user</button>
      {open && (
        <Modal title="Invite user" onClose={close}>
          {invited ? (
            <div className="stack">
              <div className="alert alert-success">Invited {invited.email}.</div>
              <p className="muted" style={{ margin: 0 }}>
                Share this one-time temporary password securely. It won&apos;t be shown again. (In production this would be an emailed invite link.)
              </p>
              <div className="card mono" style={{ padding: 10 }}>{invited.tempPassword}</div>
              <button className="btn" onClick={close}>Done</button>
            </div>
          ) : (
            <form className="stack" onSubmit={onSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              <label className="field">
                Name
                <input className="input" name="name" required minLength={2} maxLength={80} autoFocus />
              </label>
              <label className="field">
                Email
                <input className="input" name="email" type="email" required />
              </label>
              <label className="field">
                Role
                <select className="select" name="role" defaultValue="MEMBER">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={close}>Cancel</button>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Inviting…' : 'Invite'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
