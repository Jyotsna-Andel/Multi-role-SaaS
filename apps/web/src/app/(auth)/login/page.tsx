import type { Metadata } from 'next';
import Link from 'next/link';
import { safeNext } from '@/lib/safe-next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <p className="muted" style={{ marginTop: 0 }}>Welcome back to your workspace.</p>
      <LoginForm next={safeNext(next)} />
      <p className="muted small" style={{ marginBottom: 0 }}>
        New here? <Link href="/register">Create an organization</Link>
      </p>
    </>
  );
}
