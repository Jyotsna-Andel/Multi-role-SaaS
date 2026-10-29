export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  WEB_ORIGIN: string;
  COOKIE_SECURE: boolean;
}

/** Fail fast on boot if configuration is missing or weak. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];
  const str = (key: string, fallback?: string) => {
    const v = (raw[key] as string | undefined) ?? fallback;
    if (!v) errors.push(`${key} is required`);
    return v ?? '';
  };

  const env: Env = {
    NODE_ENV: (str('NODE_ENV', 'development') as Env['NODE_ENV']),
    PORT: Number(str('PORT', '4000')),
    DATABASE_URL: str('DATABASE_URL'),
    REDIS_URL: str('REDIS_URL'),
    JWT_ACCESS_SECRET: str('JWT_ACCESS_SECRET'),
    WEB_ORIGIN: str('WEB_ORIGIN', 'http://localhost:3000'),
    COOKIE_SECURE: str('COOKIE_SECURE', 'false') === 'true',
  };

  if (env.JWT_ACCESS_SECRET.length < 32) errors.push('JWT_ACCESS_SECRET must be at least 32 characters');
  if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) errors.push('COOKIE_SECURE must be true in production');
  if (errors.length) throw new Error(`Invalid environment:\n - ${errors.join('\n - ')}`);
  return env;
}
