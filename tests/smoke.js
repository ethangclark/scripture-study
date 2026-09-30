// Explicit opt-in smoke test for a deployed instance; uses three login submissions.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const origin = new URL(process.argv[2]).origin;
const name = 'smoke-' + randomUUID();
const mark = { volume: 'ot', b: 0, c: 0, v: 0 };
const cookies = [];
async function request(path, method = 'GET', data, cookie) {
  return fetch(origin + path, { method, headers: { Origin: origin,
    ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(20000) });
}
async function login(username) {
  const response = await request('/api/login', 'POST', { username });
  assert.equal(response.status, 200, await response.clone().text());
  const cookie = response.headers.get('Set-Cookie').split(';')[0];
  cookies.push(cookie);
  return cookie;
}
try {
  for (const path of ['/', '/bom/', '/ot/', '/login/', '/catalog.js', '/account.js']) assert.equal((await request(path)).status, 200);
  const first = await login(name);
  assert.equal((await request('/api/bookmarks', 'PUT', mark, first)).status, 200);
  assert.equal((await request('/api/logout', 'POST', undefined, first)).status, 200);
  assert.equal((await request('/api/bookmarks', 'GET', undefined, first)).status, 401);
  const second = await login(name);
  const saved = await (await request('/api/bookmarks', 'GET', undefined, second)).json();
  assert.equal(saved.bookmarks.length, 1);
  assert.equal(saved.bookmarks[0].ref, 'Genesis 1:1');
  assert.equal((await request('/api/bookmarks', 'PUT', { ...mark, arbitrary: 'rejected' }, second)).status, 400);
  assert.equal((await request('/api/bookmarks', 'PUT', { ...mark, v: 999999 }, second)).status, 400);
  const third = await login(name + '-other');
  assert.equal((await (await request('/api/bookmarks', 'GET', undefined, third)).json()).bookmarks.length, 0);
  assert.equal((await request('/api/bookmarks', 'DELETE', mark, second)).status, 200);
  assert.equal((await (await request('/api/bookmarks', 'GET', undefined, second)).json()).bookmarks.length, 0);
  console.log('PASS: public pages, fresh-session persistence, name isolation, invalid bookmark rejection, deletion and logout.');
} finally {
  for (const cookie of cookies) {
    await request('/api/bookmarks', 'DELETE', mark, cookie);
    await request('/api/logout', 'POST', undefined, cookie);
  }
}
