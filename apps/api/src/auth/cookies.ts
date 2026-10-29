import type { CookieOptions, Request, Response } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

function base(secure: boolean): CookieOptions {
  // httpOnly: unreadable by JS (XSS can't exfiltrate). sameSite=lax: not sent on
  // cross-site POST/PATCH/DELETE (CSRF). secure: HTTPS-only in production.
  return { httpOnly: true, secure, sameSite: 'lax', path: '/' };
}

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }, secure: boolean) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base(secure), maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base(secure), maxAge: REFRESH_TTL_SECONDS * 1000 });
}

export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(ACCESS_COOKIE, base(secure));
  res.clearCookie(REFRESH_COOKIE, base(secure));
}

export function extractAccessToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[ACCESS_COOKIE];
}
