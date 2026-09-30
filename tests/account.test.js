import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile('reader/account.js', 'utf8');
const catalog = JSON.parse(await readFile('worker/catalog.json', 'utf8'));
const mark = { volume: 'bom', b: 0, c: 0, v: 0 };
class Element extends EventTarget {
  children = []; hidden = false; disabled = false; textContent = ''; value = '';
  append(...children) { this.children.push(...children); }
  setAttribute() {}
  focus() {}
  remove() { this.removed = true; }
}
async function browser({ storage = new Map(), username = null, loginPage = false, failSave = false, failNetwork = false, failImportAt = 0, returnTo = '' } = {}) {
  const window = new EventTarget();
  window.ScriptureCatalog = catalog;
  const elements = new Map();
  if (loginPage) for (const id of ['account-current', 'account-name', 'login-submit', 'logout', 'bookmark-name', 'login-form', 'account-status', 'import-local', 'local-import', 'local-count', 'import-name', 'back-to-bookmarks']) elements.set(id, new Element());
  const body = new Element(), calls = [], online = [];
  let puts = 0;
  const fetch = async (path, options = {}) => {
    calls.push(path);
    if (failNetwork) throw new Error('offline');
    if (path === '/api/session') return Response.json({ username });
    if (path === '/api/login') { username = JSON.parse(options.body).username; return Response.json({ username }); }
    if (path === '/api/logout') { username = null; return Response.json({ ok: true }); }
    if (options.method === 'PUT') {
      if (++puts === failImportAt) return Response.json({ error: 'Storage full' }, { status: 409 });
      const m = { ...JSON.parse(options.body), t: Date.now() }; online.push(m);
      return Response.json({ bookmark: m });
    }
    return Response.json({ bookmarks: online });
  };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) { if (failSave) throw new Error('quota'); storage.set(key, value); },
  };
  vm.runInNewContext(source, { window, document: { body, getElementById: id => elements.get(id) ?? null, createElement: () => new Element() }, localStorage, fetch, Event, AbortSignal, URL, URLSearchParams, location: { pathname: loginPage ? '/login/' : '/bom/', hash: '#bookmarks', search: returnTo, origin: 'https://scripture.test' } });
  const account = window.ScriptureAccount;
  await account.ready;
  const click = async (id, event = 'click') => {
    elements.get(id).dispatchEvent(new Event(event, { cancelable: true }));
    for (let i = 0; i < 50 && elements.get('login-submit').disabled; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.get('login-submit').disabled, false);
  };
  return { account, body, elements, calls, online, storage, click };
}
test('signed-out bookmarks persist locally and the notice is shown once across visits', async () => {
  const first = await browser();
  assert.equal((await first.account.change(mark, false)).localNotice, true);
  assert.equal(first.body.children.length, 1);
  assert.equal(first.account.bookmarks[0].ref, '1 Nephi 1:1');
  await first.account.change({ ...mark, v: 1 }, false);
  assert.equal(first.body.children.length, 1);
  assert.deepEqual(first.calls, ['/api/session']);
  const next = await browser({ storage: first.storage });
  assert.equal(next.account.bookmarks.length, 2);
  assert.equal((await next.account.change({ ...mark, v: 2 }, false)).localNotice, false);
  await next.account.change(mark, true);
  assert.equal(next.account.bookmarks.length, 2);
});
test('local storage failures never claim a successful save or consume the notice', async () => {
  const b = await browser({ failSave: true });
  await assert.rejects(b.account.change(mark, false), /could not save/);
  assert.equal(b.account.bookmarks.length, 0);
  assert.equal(b.body.children.length, 0);
});
test('local bookmarks work when the online service is unavailable', async () => {
  const b = await browser({ failNetwork: true });
  await b.account.change(mark, false);
  assert.equal(b.account.bookmarks.length, 1);
  assert.match(b.account.message, /Showing bookmarks saved in this browser/);
});
test('invalid stored coordinates are ignored and labels are regenerated', async () => {
  const storage = new Map([['bom-abr:bookmarks', JSON.stringify([{ ...mark, ref: '<script>', slug: 'https://bad.test' }, { ...mark, v: 99999 }, { ...mark, b: '0' }])]]);
  const b = await browser({ storage });
  assert.equal(b.account.bookmarks.length, 1);
  assert.equal(b.account.bookmarks[0].ref, '1 Nephi 1:1');
  assert.equal(b.account.bookmarks[0].slug, '1-ne-1.1');
});
test('login does not silently transfer local marks; explicit transfer and logout preserve the right collection', async () => {
  const storage = new Map([['bom-abr:bookmarks', JSON.stringify([mark])]]);
  const b = await browser({ storage, loginPage: true });
  b.elements.get('bookmark-name').value = 'shared-name';
  await b.click('login-form', 'submit');
  assert.equal(b.account.username, 'shared-name');
  assert.equal(b.account.bookmarks.length, 0);
  assert.equal(b.elements.get('local-import').hidden, false);
  assert.equal(b.online.length, 0);
  await b.click('import-local');
  assert.equal(b.online.length, 1);
  assert.equal(b.account.bookmarks.length, 1);
  assert.equal(JSON.parse(storage.get('bom-abr:bookmarks')).length, 0);
  await b.click('logout');
  assert.equal(b.account.username, null);
  assert.equal(b.account.bookmarks.length, 0);
});
test('partially failed imports keep unsaved local bookmarks for retry', async () => {
  const storage = new Map([['bom-abr:bookmarks', JSON.stringify([mark, { ...mark, v: 1 }])]]);
  const b = await browser({ storage, loginPage: true, username: 'test', failImportAt: 2 });
  await b.click('import-local');
  assert.equal(b.online.length, 1);
  assert.equal(JSON.parse(storage.get('bom-abr:bookmarks')).length, 1);
  assert.match(b.account.message, /not transferred remain/);
});
test('bookmark login return links stay on the reader site', async () => {
  const b = await browser({ loginPage: true, returnTo: '?return=https://bad.test' });
  assert.equal(b.elements.get('back-to-bookmarks').href, '/#libbm');
  const reader = await browser({ loginPage: true, returnTo: '?return=%2Fom%2F' });
  assert.equal(reader.elements.get('back-to-bookmarks').href, '/#libbm');
  const malformed = await browser({ loginPage: true, returnTo: '?return=http://[' });
  assert.equal(malformed.elements.get('back-to-bookmarks').href, '/#libbm');
  const valid = await browser({ loginPage: true, returnTo: '?return=%2Fbom%2F%23bookmarks' });
  assert.equal(valid.elements.get('back-to-bookmarks').href, '/bom/#bookmarks');
});
test('only the dedicated login page contains login controls', async () => {
  for (const path of ['index.html', 'bom/index.html', 'ot/index.html']) {
    const html = await readFile('reader/_site/' + path, 'utf8');
    assert.ok(!html.includes('id="login-form"'));
    assert.ok(html.includes('Log in to save across devices'));
  }
  const login = await readFile('reader/_site/login/index.html', 'utf8');
  assert.ok(login.includes('id="login-form"'));
  assert.ok(login.includes('id="import-local"'));
});
