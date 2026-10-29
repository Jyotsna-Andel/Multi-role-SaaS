import 'server-only';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import type { Me } from './types';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Fetch from NestJS inside a Server Component. Forwards the caller's cookies
 * (so the API knows who they are) and client IP (so rate limits stay per-user).
 */
export async function serverApi<T>(path: string): Promise<T> {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: {
      cookie: cookieStore.toString(),
      'x-forwarded-for': hdrs.get('x-forwarded-for') ?? '127.0.0.1',
      'user-agent': hdrs.get('user-agent') ?? '',
    },
    cache: 'no-store', // per-user data: never share via Next's fetch cache (Redis caches on the API side)
  });

  if (res.status === 401) redirect('/login');
  if (res.status === 403 || res.status === 404) notFound();
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

/** Current user, de-duplicated per request: layout + page + guards share one API call. */
export const getMe = cache(() => serverApi<Me>('/auth/me'));
