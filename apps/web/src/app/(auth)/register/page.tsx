import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Create organization' };

export default function RegisterPage() {
  return (
    <>
      <h1>Create your organization</h1>
      <p className="muted" style={{ marginTop: 0 }}>You&apos;ll be its first admin.</p>
      <RegisterForm />
      <p className="muted small" style={{ marginBottom: 0 }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </>
  );
}
