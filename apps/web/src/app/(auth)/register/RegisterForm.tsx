'use client';

import { FormEvent, useState } from 'react';
import { api, json } from '@/lib/api';

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setLoading(true);
    setError(null);
    try {
      await api('/auth/register', { method: 'POST', body: json(form) });
      window.location.assign('/dashboard');
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <label className="field">
        Organization name
        <input className="input" name="orgName" required minLength={2} maxLength={80} />
      </label>
      <label className="field">
        Your name
        <input className="input" name="name" autoComplete="name" required minLength={2} maxLength={80} />
      </label>
      <label className="field">
        Email
        <input className="input" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        Password
        <input className="input" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
        <span className="muted small">8+ characters with upper case, lower case and a digit.</span>
      </label>
      <button className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create organization'}</button>
    </form>
  );
}
