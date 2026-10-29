'use client';

import { useState } from 'react';
import { api, json } from '@/lib/api';

const DEMO_ACCOUNTS = [
  { email: 'admin@acme.test', label: 'Acme · Admin' },
  { email: 'manager@acme.test', label: 'Acme · Manager' },
  { email: 'member@acme.test', label: 'Acme · Member' },
  { email: 'admin@globex.test', label: 'Globex · Admin' },
];
const DEMO_PASSWORD = 'Password123!';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: string, p: string) {
    setLoading(true);
    setError(null);
    try {
      await api('/auth/login', { method: 'POST', body: json({ email: e, password: p }) });
      // Full navigation so the server layout re-renders with the new cookies.
      window.location.assign(next);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(email, password);
        }}
      >
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>

      <div className="demo-accounts">
        <div className="muted small">Demo accounts (password <span className="mono">{DEMO_PASSWORD}</span>)</div>
        {DEMO_ACCOUNTS.map((a) => (
          <button key={a.email} type="button" className="btn btn-sm" disabled={loading} onClick={() => signIn(a.email, DEMO_PASSWORD)}>
            <span>{a.label}</span>
            <span className="muted small">{a.email}</span>
          </button>
        ))}
      </div>
    </>
  );
}
