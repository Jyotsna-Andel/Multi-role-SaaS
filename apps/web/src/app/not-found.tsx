import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>Not found</h1>
        <p className="muted">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Link className="btn" href="/dashboard">Go to dashboard</Link>
      </div>
    </div>
  );
}
