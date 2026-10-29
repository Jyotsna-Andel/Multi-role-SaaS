'use client';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Shared across concurrent calls: if five requests 401 at once, they all wait on ONE
// refresh. Parallel refreshes would look like token reuse to the API and revoke the session.
let refreshing: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST' })
    .then((r) => r.ok)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

/** Browser-side fetch to our API (same origin, cookies sent automatically). */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const send = () =>
    fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });

  let res = await send();
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshOnce()) res = await send();
    else {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      throw new ApiError(401, 'Session expired');
    }
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? res.statusText);
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

export const json = (data: unknown): RequestInit['body'] => JSON.stringify(data);
