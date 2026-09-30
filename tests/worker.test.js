import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

let mf, db, catalog, ipCounter = 0;
const origin = 'https://scripture.test';
const mark = { volume: 'bom', b: 0, c: 0, v: 0 };
before(async () => {
  catalog = JSON.parse(await readFile('worker/catalog.json', 'utf8'));
  const source = (await readFile('worker/index.js', 'utf8')).replace("import catalog from './catalog.json';", `const catalog = ${JSON.stringify(catalog)};`);
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: source, compatibilityDate: '2026-09-30', d1Databases: ['DB'], cf: false }));
  db = await mf.getD1Database('DB');
  const schema = await readFile('migrations/0001_bookmarks.sql', 'utf8');
  await db.batch(schema.split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
});
after(async () => { await mf?.dispose(); });
function request(path, { method = 'GET', data, cookie, ip = '192.0.2.1', headers = {}, raw } = {}) {
  return mf.dispatchFetch(origin + path, { method, headers: {
    Origin: origin, 'CF-Connecting-IP': ip,
    ...(data !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(cookie ? { Cookie: cookie } : {}), ...headers,
  }, body: raw ?? (data !== undefined ? JSON.stringify(data) : undefined) });
}
async function login(username, ip = `198.51.100.${++ipCounter}`) {
  const response = await request('/api/login', { method: 'POST', data: { username }, ip });
  assert.equal(response.status, 200, await response.clone().text());
  return response.headers.get('Set-Cookie').split(';')[0];
}
async function bookmarks(cookie) {
  const response = await request('/api/bookmarks', { cookie });
  assert.equal(response.status, 200);
  return (await response.json()).bookmarks;
}
test('bookmark persistence across sessions, names isolated, logout revokes session', async () => {
  const first = await login('persist-test');
  const saved = await request('/api/bookmarks', { method: 'PUT', data: mark, cookie: first });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).bookmark.ref, '1 Nephi 1:1');
  assert.equal((await request('/api/logout', { method: 'POST', cookie: first })).status, 200);
  assert.equal((await request('/api/bookmarks', { cookie: first })).status, 401);
  const second = await login('persist-test');
  assert.equal((await bookmarks(second)).length, 1);
  assert.equal((await bookmarks(await login('other-name'))).length, 0);
  assert.equal((await bookmarks(await login('Persist-test'))).length, 0);
  assert.equal((await request('/api/bookmarks', { method: 'DELETE', data: mark, cookie: second })).status, 200);
  assert.equal((await bookmarks(await login('persist-test'))).length, 0);
});
test('cookies have required protections; expired and forged sessions cannot write', async () => {
  const r = await request('/api/login', { method: 'POST', data: { username: 'expiry-test' }, ip: '198.51.100.200' });
  for (const flag of ['__Host-', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=2592000']) assert.ok(r.headers.get('Set-Cookie').includes(flag));
  const cookie = r.headers.get('Set-Cookie').split(';')[0];
  await db.prepare('UPDATE sessions SET expires_at = 0 WHERE username = ?').bind('expiry-test').run();
  for (const invalid of [cookie, '__Host-scripture-session=' + 'a'.repeat(64), undefined]) {
    assert.equal((await request('/api/bookmarks', { method: 'PUT', cookie: invalid, data: mark })).status, 401);
  }
});
test('strict bookmark validation rejects arbitrary payloads and impossible references', async () => {
  const cookie = await login('validation-test');
  const bad = [
    { ...mark, text: 'arbitrary data' }, { ...mark, ref: 'arbitrary data' }, { ...mark, t: 1 },
    { ...mark, username: 'another-user' }, { ...mark, b: '0' }, { ...mark, c: -1 },
    { ...mark, v: 0.5 }, { ...mark, b: 99999 }, { ...mark, c: 99999 },
    { ...mark, v: catalog.bom[0].chapters[0] }, { ...mark, volume: '__proto__' },
    { ...mark, volume: 'nt' }, {}, [], null,
  ];
  for (const data of bad) {
    for (const method of ['PUT', 'DELETE']) assert.equal((await request('/api/bookmarks', { method, cookie, data })).status, 400, JSON.stringify(data));
  }
  assert.equal((await request('/api/bookmarks', { method: 'PUT', cookie, raw: '{' })).status, 400);
  assert.equal((await request('/api/bookmarks', { method: 'PUT', cookie, raw: ' '.repeat(1025) })).status, 413);
  assert.equal((await request('/api/bookmarks', { method: 'PUT', cookie, data: mark, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await bookmarks(cookie)).length, 0);
  for (const volume of ['bom', 'ot']) {
    const b = catalog[volume].length - 1, c = catalog[volume][b].chapters.length - 1;
    assert.equal((await request('/api/bookmarks', { method: 'PUT', cookie, data: { volume, b, c, v: catalog[volume][b].chapters[c] - 1 } })).status, 200);
  }
});
test('cross-origin mutations are rejected', async () => {
  const cookie = await login('csrf-test');
  for (const headers of [{ Origin: 'https://attacker.test' }, { Origin: '' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await request('/api/bookmarks', { method: 'PUT', cookie, data: mark, headers })).status, 403);
    assert.equal((await request('/api/login', { method: 'POST', data: { username: 'victim' }, headers })).status, 403);
  }
});
test('100 submissions per rolling seven days, including malformed logins; concurrency is atomic', async () => {
  const ip = '203.0.113.10';
  const responses = await Promise.all(Array.from({ length: 105 }, () => request('/api/login', { method: 'POST', ip, data: {} })));
  assert.equal(responses.filter(r => r.status === 400).length, 100);
  assert.equal(responses.filter(r => r.status === 429).length, 5);
  assert.ok(Number(responses.find(r => r.status === 429).headers.get('Retry-After')) > 0);
  // One attempt aging out allows exactly one new admission, not a calendar reset.
  await db.prepare('UPDATE login_attempts SET attempted_at = ? WHERE id = (SELECT MIN(id) FROM login_attempts WHERE ip_hash = (SELECT ip_hash FROM login_attempts GROUP BY ip_hash HAVING COUNT(*) = 100))')
    .bind(Date.now() - 7 * 86400000 - 1).run();
  const next = await request('/api/login', { method: 'POST', ip, data: { username: 'rate-test' } });
  assert.equal(next.status, 200);
  assert.equal((await request('/api/login', { method: 'POST', ip, data: { username: 'rate-test' } })).status, 429);
  const cookie = next.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await request('/api/session', { cookie, ip })).status, 200);
  assert.equal((await request('/api/bookmarks', { cookie, ip, method: 'PUT', data: mark })).status, 200);
  await login('different-ip', '203.0.113.11');
});
test('names normalize surrounding spaces and Unicode, with strict size and field limits', async () => {
  const cookie = await login('  caf\u0065\u0301  ');
  assert.equal((await (await request('/api/session', { cookie })).json()).username, 'café');
  for (const username of ['', '   ', 'a'.repeat(65), 'name\nline', 12, '\u0000']) {
    assert.equal((await request('/api/login', { method: 'POST', data: { username }, ip: '203.0.113.20' })).status, 400);
  }
  assert.equal((await request('/api/login', { method: 'POST', data: { username: 'ok', notes: 'anything' }, ip: '203.0.113.20' })).status, 400);
});
test('bookmark cap is atomic, duplicates are idempotent, removal frees capacity', async () => {
  const cookie = await login('capacity-test');
  const { owner } = await db.prepare('SELECT owner FROM sessions WHERE username = ?').bind('capacity-test').first();
  const verses = catalog.bom.flatMap((book, b) => book.chapters.flatMap((n, c) => Array.from({ length: n }, (_, v) => ({ volume: 'bom', b, c, v })))).slice(0, 1001);
  await db.prepare(`INSERT INTO bookmarks SELECT ?, 'bom', json_extract(value, '$.b'), json_extract(value, '$.c'), json_extract(value, '$.v'), ? FROM json_each(?)`)
    .bind(owner, Date.now(), JSON.stringify(verses.slice(0, 999))).run();
  const responses = await Promise.all(verses.slice(999).map(data => request('/api/bookmarks', { method: 'PUT', cookie, data })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await bookmarks(cookie)).length, 1000);
  assert.equal((await request('/api/bookmarks', { method: 'PUT', cookie, data: verses[0] })).status, 200);
  assert.equal((await bookmarks(cookie)).length, 1000);
  assert.equal((await request('/api/bookmarks', { method: 'DELETE', cookie, data: verses[0] })).status, 200);
  assert.equal((await request('/api/bookmarks', { method: 'PUT', cookie, data: verses[0] })).status, 200);
});
