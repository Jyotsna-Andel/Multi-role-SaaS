import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const PUBLIC_PATHS = ['/login', '/register'];

/**
 * UX gate, not the security boundary (the API authorizes every request).
 * - no access cookie + refresh cookie → refresh silently, continue
 * - no cookies at all → /login?next=...
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.has('access_token')) return NextResponse.next();

  if (req.cookies.has('refresh_token')) {
    const refreshed = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: req.headers.get('cookie') ?? '',
        'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '127.0.0.1',
        'user-agent': req.headers.get('user-agent') ?? '',
      },
    }).catch(() => null);

    if (refreshed?.ok) {
      const setCookies = refreshed.headers.getSetCookie();

      // Rebuild the Cookie header so Server Components in THIS request see the new tokens...
      const jar = new Map(req.cookies.getAll().map((c) => [c.name, c.value]));
      for (const sc of setCookies) {
        const [pair] = sc.split(';');
        const i = pair.indexOf('=');
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));

      // ...and forward Set-Cookie so the browser stores them for next time.
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      for (const sc of setCookies) res.headers.append('set-cookie', sc);
      return res;
    }
  }

  const login = new URL('/login', req.url);
  login.searchParams.set('next', pathname + search);
  const res = NextResponse.redirect(login);
  res.cookies.delete('refresh_token');
  return res;
}

export const config = {
  runtime: 'nodejs',
  // Skip API proxying and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
