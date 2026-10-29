// End-to-end demo of every feature against a running API.
//   npm run demo                (API on http://localhost:4000)
//   API_URL=http://host:port npm run demo
//
// Each "actor" sends a distinct X-Forwarded-For so per-IP rate limits don't
// interfere between steps (the API trusts XFF from loopback = the Next.js proxy).

const API = (process.env.API_URL ?? 'http://localhost:4000') + '/api';
const PASSWORD = 'Password123!';
let passed = 0;
let failed = 0;

class Client {
  constructor(ip) {
    this.ip = ip;
    this.cookies = new Map();
  }
  async req(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': this.ip,
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const [k, v] = [pair.slice(0, i), pair.slice(i + 1)];
      if (v) this.cookies.set(k, v);
      else this.cookies.delete(k);
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  }
  login(email, password = PASSWORD) {
    return this.req('POST', '/auth/login', { email, password });
  }
}

function check(label, ok, detail = '') {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m'} ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`);
}
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const rnd = () => Math.random().toString(36).slice(2, 8);
const octet = () => Math.floor(Math.random() * 250);
const ip = () => `10.${octet()}.${octet()}.${octet()}`;
const client = () => new Client(ip());

async function main() {
  section('0. Health');
  const health = await client().req('GET', '/health');
  check('API, Postgres and Redis are up', health.status === 200 && health.body.cache === 'up', JSON.stringify(health.body));

  section('1. Secure auth (httpOnly cookies, no tokens in body)');
  const admin = client();
  const login = await admin.login('admin@acme.test');
  check('Admin logs in', login.status === 200, `role=${login.body?.user?.role}`);
  check('Tokens are only in httpOnly cookies', admin.cookies.has('access_token') && !JSON.stringify(login.body).includes('token'));
  check('Unauthenticated request is rejected → 401', (await client().req('GET', '/projects')).status === 401);
  const bad = await client().login('admin@acme.test', 'wrong');
  const ghost = await client().login('nobody@acme.test', 'wrong');
  check('Same generic error for bad password and unknown email', bad.body?.message === ghost.body?.message, bad.body?.message);

  section('2. RBAC (ADMIN / MANAGER / MEMBER)');
  const manager = client();
  const member = client();
  await manager.login('manager@acme.test');
  await member.login('member@acme.test');
  check('MEMBER can read projects', (await member.req('GET', '/projects')).status === 200);
  check('MEMBER cannot create projects → 403', (await member.req('POST', '/projects', { name: 'Nope' })).status === 403);
  const created = await manager.req('POST', '/projects', { name: `Demo ${rnd()}`, description: 'Created by demo script' });
  check('MANAGER can create projects → 201', created.status === 201, created.body?.name);
  check('MANAGER cannot delete projects → 403', (await manager.req('DELETE', `/projects/${created.body.id}`)).status === 403);
  check('MANAGER cannot view audit logs → 403', (await manager.req('GET', '/audit-logs')).status === 403);
  check('MEMBER cannot list users → 403', (await member.req('GET', '/users')).status === 403);
  check('ADMIN can delete projects → 204', (await admin.req('DELETE', `/projects/${created.body.id}`)).status === 204);
  const massAssign = await manager.req('POST', '/projects', { name: 'Evil', orgId: '00000000-0000-0000-0000-000000000000' });
  check('Unknown fields rejected (mass-assignment protection) → 400', massAssign.status === 400);

  section('3. Multi-tenancy isolation');
  const globex = client();
  await globex.login('admin@globex.test');
  const acmeProject = (await admin.req('GET', '/projects?limit=1')).body.data[0];
  check("Globex admin can't read an Acme project → 404", (await globex.req('GET', `/projects/${acmeProject.id}`)).status === 404);
  check("Globex admin can't edit an Acme project → 404", (await globex.req('PATCH', `/projects/${acmeProject.id}`, { name: 'pwned' })).status === 404);
  const globexList = await globex.req('GET', '/projects?limit=100');
  check('Globex only sees its own projects', globexList.body.meta.total === 7, `total=${globexList.body.meta.total}`);

  section('4. Pagination');
  const p1 = await admin.req('GET', '/projects?page=1&limit=5&sort=name');
  const p2 = await admin.req('GET', '/projects?page=2&limit=5&sort=name');
  check('Offset pagination returns page meta', p1.body.meta.limit === 5 && p1.body.meta.totalPages >= 9, JSON.stringify(p1.body.meta));
  check('Pages do not overlap', !p2.body.data.some((x) => p1.body.data.find((y) => y.id === x.id)));
  check('limit > 100 is rejected → 400', (await admin.req('GET', '/projects?limit=1000')).status === 400);
  const a1 = await admin.req('GET', '/audit-logs?limit=3');
  const a2 = await admin.req('GET', `/audit-logs?limit=3&cursor=${a1.body.nextCursor}`);
  check('Cursor pagination on audit logs', a1.body.data.length === 3 && !!a1.body.nextCursor && a2.body.data[0]?.id !== a1.body.data[0].id, `nextCursor=${a1.body.nextCursor?.slice(0, 8)}…`);

  section('5. Redis cache (cache-aside + version invalidation)');
  const q = `/projects?page=1&limit=5&search=${rnd()}`;
  const c1 = await admin.req('GET', q);
  const c2 = await admin.req('GET', q);
  check('First read is a MISS, second a HIT', c1.headers.get('x-cache') === 'MISS' && c2.headers.get('x-cache') === 'HIT', `${c1.headers.get('x-cache')} → ${c2.headers.get('x-cache')}`);
  const tmp = await admin.req('POST', '/projects', { name: `Cache-buster ${rnd()}` });
  check('A write invalidates the cache → MISS', (await admin.req('GET', q)).headers.get('x-cache') === 'MISS');
  await admin.req('DELETE', `/projects/${tmp.body.id}`);

  section('6. Transactions & business invariants');
  const users = (await admin.req('GET', '/users?limit=50')).body.data;
  const me = users.find((u) => u.email === 'admin@acme.test');
  const demote = await admin.req('PATCH', `/users/${me.id}/role`, { role: 'MEMBER' });
  check('Cannot demote the last admin (Serializable tx) → 409', demote.status === 409, demote.body?.message);
  const email = `new.${rnd()}@acme.test`;
  const invite = await admin.req('POST', '/users', { email, name: 'New Hire', role: 'MEMBER' });
  check('Admin invites a user (user + audit row in one tx)', invite.status === 201 && !!invite.body.tempPassword);
  const newbie = client();
  check('Invited user can log in with temp password', (await newbie.login(email, invite.body.tempPassword)).status === 200);
  check('…and as MEMBER cannot create projects → 403', (await newbie.req('POST', '/projects', { name: 'Nope' })).status === 403);
  await admin.req('PATCH', `/users/${invite.body.user.id}/role`, { role: 'MANAGER' });
  check('Promotion applies on next request, no re-login → 201', (await newbie.req('POST', '/projects', { name: `By promoted ${rnd()}` })).status === 201);
  await admin.req('PATCH', `/users/${invite.body.user.id}/status`, { isActive: false });
  check('Deactivated user is kicked out immediately → 401', (await newbie.req('GET', '/projects')).status === 401);

  section('7. Refresh-token rotation & reuse detection');
  const victim = client();
  await victim.login('member@acme.test');
  const stolen = victim.cookies.get('refresh_token');
  const r1 = await victim.req('POST', '/auth/refresh');
  check('Refresh rotates the token', r1.status === 200 && victim.cookies.get('refresh_token') !== stolen);
  console.log('  \x1b[2m…waiting 10s to pass the benign-race grace window\x1b[0m');
  await new Promise((r) => setTimeout(r, 10_500));
  const attacker = client();
  attacker.cookies.set('refresh_token', stolen);
  check('Replaying the old (stolen) token → 401', (await attacker.req('POST', '/auth/refresh')).status === 401);
  check('…the whole token family is revoked (victim must re-login)', (await victim.req('POST', '/auth/refresh')).status === 401);
  const victimAgain = client();
  await victimAgain.login('member@acme.test');
  check('…and the user can still log in fresh', (await victimAgain.req('GET', '/auth/me')).status === 200);

  section('8. Rate limiting & account lockout');
  const bot = client();
  const statuses = [];
  for (let i = 0; i < 7; i++) statuses.push((await bot.login(`bot${i}@nowhere.test`, 'x')).status);
  check('Login limited to 5/min per IP → 429', statuses.includes(429), statuses.join(','));
  // A distributed attack (new IP every attempt) dodges the IP limit — per-account lockout catches it.
  for (let i = 0; i < 5; i++) await client().login('intern@acme.test', 'wrong');
  check('5 failures lock the account, even with the right password → 401', (await client().login('intern@acme.test')).status === 401);

  section('9. Audit trail');
  const audit = await admin.req('GET', '/audit-logs?limit=100');
  const actions = new Set(audit.body.data.map((a) => a.action));
  for (const a of ['auth.login', 'auth.login_failed', 'auth.account_locked', 'auth.refresh_reuse_detected', 'access.denied', 'project.created', 'project.deleted', 'user.invited', 'user.role_changed', 'user.deactivated']) {
    check(`audit: ${a}`, actions.has(a));
  }

  console.log(`\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m`);
  console.log('\x1b[2mThe intern account stays locked for 15 min — run `npm run db:seed` to reset demo data.\x1b[0m');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
