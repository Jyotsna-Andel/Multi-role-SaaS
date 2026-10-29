'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useSession } from '@/components/SessionProvider';
import { api, json } from '@/lib/api';
import { PROJECT_STATUSES, type Project } from '@/lib/types';

function ProjectFormModal({ project, onClose }: { project?: Project; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setSaving(true);
    setError(null);
    try {
      await api(project ? `/projects/${project.id}` : '/projects', { method: project ? 'PATCH' : 'POST', body: json(data) });
      onClose();
      router.refresh(); // re-run the Server Component with fresh data
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
        <label className="field">
          Name
          <input className="input" name="name" required minLength={2} maxLength={120} defaultValue={project?.name} autoFocus />
        </label>
        <label className="field">
          Description
          <textarea className="input" name="description" rows={3} maxLength={2000} defaultValue={project?.description ?? ''} />
        </label>
        <label className="field">
          Status
          <select className="select" name="status" defaultValue={project?.status ?? 'ACTIVE'}>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function NewProjectButton() {
  const { can } = useSession();
  const [open, setOpen] = useState(false);
  if (!can('project:write')) return null;
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>+ New project</button>
      {open && <ProjectFormModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function RowActions({ project }: { project: Project }) {
  const { can } = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Delete "${project.name}"? This is recorded in the audit log.`)) return;
    setBusy(true);
    try {
      await api(`/projects/${project.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  if (!can('project:write') && !can('project:delete')) return <span className="muted small">Read only</span>;
  return (
    <div className="row" style={{ justifyContent: 'flex-end' }}>
      {can('project:write') && <button className="btn btn-sm" onClick={() => setEditing(true)}>Edit</button>}
      {can('project:delete') && <button className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>Delete</button>}
      {editing && <ProjectFormModal project={project} onClose={() => setEditing(false)} />}
    </div>
  );
}
