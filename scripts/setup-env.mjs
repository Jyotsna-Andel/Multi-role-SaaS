// Creates apps/api/.env from .env.example with a freshly generated JWT secret.
// Never overwrites an existing .env. Run via `npm run setup` (or `node scripts/setup-env.mjs`).
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const target = new URL('../apps/api/.env', import.meta.url);
const example = new URL('../apps/api/.env.example', import.meta.url);

if (existsSync(target)) {
  console.log('apps/api/.env already exists — leaving it unchanged.');
} else {
  const secret = randomBytes(48).toString('base64url');
  const content = readFileSync(example, 'utf8').replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret}`);
  writeFileSync(target, content);
  console.log('Created apps/api/.env with a random JWT_ACCESS_SECRET.');
}
