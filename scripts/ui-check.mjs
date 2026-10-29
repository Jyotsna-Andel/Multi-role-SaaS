const WEB = 'http://localhost:3000';
const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
const jar = (res, cookies = new Map()) => {
  for (const c of res.headers.getSetCookie()) {
    const [p] = c.split(';'); const i = p.indexOf('=');
    const v = p.slice(i + 1); v ? cookies.set(p.slice(0, i), v) : cookies.delete(p.slice(0, i));
  }
  return cookies;
};
const hdr = (m) => [...m].map(([k, v]) => `${k}=${v}`).join('; ');
async function login(email, ip) {
  const r = await fetch(`${WEB}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email, password: 'Password123!' }) });
  return { status: r.status, cookies: jar(r) };
}
const page = (path, cookies) => fetch(WEB + path, { redirect: 'manual', headers: { cookie: hdr(cookies) } });

// warm up compilation
for (const p of ['/login', '/dashboard', '/projects', '/admin/users', '/admin/audit']) await fetch(WEB + p, { redirect: 'manual' }).catch(() => {});

const r1 = await page('/dashboard', new Map());
ok('Logged-out /dashboard redirects to /login', r1.status === 307 && r1.headers.get('location')?.includes('/login?next=%2Fdashboard'), `${r1.status} ${r1.headers.get('location')}`);

const admin = await login('admin@acme.test', '10.1.1.1');
ok('Login through Next proxy sets httpOnly cookies', admin.status === 200 && admin.cookies.has('access_token') && admin.cookies.has('refresh_token'));

const dash = await page('/dashboard', admin.cookies);
const html = await dash.text();
ok('Dashboard server-renders for admin', dash.status === 200 && html.includes('Welcome') && html.includes('Ada'));
ok('Admin sees Admin nav links', html.includes('/admin/users') && html.includes('/admin/audit'));

const proj = await page('/projects?search=Apollo&status=ACTIVE', admin.cookies);
const ph = await proj.text();
ok('Projects page filters server-side', proj.status === 200 && ph.includes('Apollo'), `${(ph.match(/Apollo/g) || []).length} matches`);

const users = await (await page('/admin/users', admin.cookies)).text();
ok('Admin can open /admin/users', users.includes('member@acme.test') && users.includes('Invite user'));

const member = await login('member@acme.test', '10.1.1.2');
const mdash = await (await page('/dashboard', member.cookies)).text();
ok('Member nav hides admin links', !mdash.includes('/admin/users'));
const madmin = await (await page('/admin/users', member.cookies)).text();
ok('Member on /admin/users sees "Not authorized"', madmin.includes('Not authorized') && !madmin.includes('admin@acme.test'));
const mproj = await (await page('/projects', member.cookies)).text();
ok('Member sees no "New project" button', !mproj.includes('New project') && mproj.includes('Read only'));

const onlyRefresh = new Map([['refresh_token', admin.cookies.get('refresh_token')]]);
const sr = await page('/dashboard', onlyRefresh);
const srHtml = await sr.text();
ok('Expired access token → middleware silently refreshes', sr.status === 200 && srHtml.includes('Welcome') && sr.headers.getSetCookie().some((c) => c.startsWith('access_token=')), `status ${sr.status}`);

const bogus = await page('/dashboard', new Map([['refresh_token', 'garbage']]));
ok('Invalid refresh token → redirect to /login', bogus.status === 307 && bogus.headers.get('location')?.includes('/login'));
