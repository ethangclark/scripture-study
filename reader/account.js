(() => {
  const $ = id => document.getElementById(id);
  const catalog = window.ScriptureCatalog;
  const NOTICE_KEY = 'scripture:local-bookmark-notice';
  let busy = false, noticed = false;
  const same = (a, b) => ['volume', 'b', 'c', 'v'].every(k => a[k] === b[k]);
  function describe(mark) {
    const { volume, b, c, v } = mark || {};
    if (!Object.hasOwn(catalog, volume) || ![b, c, v].every(n => Number.isSafeInteger(n) && n >= 0) || !(catalog[volume][b]?.chapters[c] > v)) return null;
    const book = catalog[volume][b];
    return { volume, b, c, v, t: Number.isFinite(mark.t) && mark.t >= 0 ? mark.t : 0,
      ref: `${book.name} ${c + 1}:${v + 1}`, slug: `${book.slug}-${c + 1}.${v + 1}` };
  }
  function readLocal() {
    const marks = [];
    for (const volume of Object.keys(catalog)) {
      try {
        const saved = JSON.parse(localStorage.getItem(volume + '-abr:bookmarks') || '[]');
        if (Array.isArray(saved)) for (const value of saved) {
          const mark = describe({ ...value, volume });
          if (mark && !marks.some(m => same(m, mark))) marks.push(mark);
        }
      } catch { /* A corrupt or unavailable store must not break reading. */ }
    }
    return marks.sort((a, b) => b.t - a.t);
  }
  function writeLocal(mark, removing) {
    const saved = readLocal(), next = saved.filter(m => !same(m, mark));
    if (!removing) {
      if (next.length >= 1000) throw new Error('This browser has 1,000 bookmarks. Remove one before adding another.');
      next.push(describe({ ...mark, t: Date.now() }));
    }
    try { localStorage.setItem(mark.volume + '-abr:bookmarks', JSON.stringify(next.filter(m => m.volume === mark.volume))); }
    catch { throw new Error('This browser could not save the bookmark. Enable site storage or log in to save online.'); }
    return readLocal();
  }
  function loginURL(back = location.pathname + location.hash) { return '/login/?return=' + encodeURIComponent(back); }
  function showLocalNotice() {
    try { if (localStorage.getItem(NOTICE_KEY)) return false; } catch {}
    if (noticed) return false;
    noticed = true;
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch {}
    const notice = document.createElement('aside');
    notice.className = 'local-notice'; notice.id = 'local-notice'; notice.setAttribute('role', 'status');
    const text = document.createElement('span'); text.textContent = 'Bookmark saved only in this browser. ';
    const link = document.createElement('a'); link.href = loginURL(); link.textContent = 'Log in to save across devices';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Got it';
    close.addEventListener('click', () => notice.remove());
    notice.append(text, link, close); document.body.append(notice);
    return true;
  }
  const account = window.ScriptureAccount = {
    username: null, bookmarks: readLocal(), loaded: false, message: '',
    loginURL,
    async change(mark, removing) {
      await account.ready;
      if (busy) throw new Error('Please wait for the current bookmark request.');
      mark = describe(mark);
      if (!mark) throw new Error('Choose an existing scripture verse.');
      setBusy(true);
      try {
        if (!account.username) {
          account.bookmarks = writeLocal(mark, removing);
          notify();
          return { localNotice: !removing && showLocalNotice() };
        }
        const data = await api('/api/bookmarks', removing ? 'DELETE' : 'PUT', coordinates(mark));
        account.bookmarks = account.bookmarks.filter(m => !same(m, mark));
        if (!removing) account.bookmarks.unshift(data.bookmark);
        status(''); notify();
        return { localNotice: false };
      } catch (error) {
        status(error.message); notify(); throw error;
      } finally { setBusy(false); }
    },
  };
  function coordinates({ volume, b, c, v }) { return { volume, b, c, v }; }
  function status(text) { account.message = text; if ($('account-status')) $('account-status').textContent = text; }
  function setBusy(value) {
    busy = value;
    for (const id of ['login-submit', 'logout', 'bookmark-name', 'import-local']) if ($(id)) $(id).disabled = value;
  }
  function notify() {
    if ($('account-current')) {
      $('account-current').hidden = !account.username;
      $('account-name').textContent = account.username || '';
      $('login-submit').textContent = account.username ? 'Switch bookmark name' : 'Load my bookmarks';
      const count = readLocal().length;
      $('local-import').hidden = !account.username || !count;
      $('local-count').textContent = String(count);
      $('import-name').textContent = account.username || '';
    }
    window.dispatchEvent(new Event('bookmarkschange'));
  }
  async function api(path, method = 'GET', data) {
    let response;
    try {
      response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
        headers: data ? { 'Content-Type': 'application/json' } : {},
        body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(15000) });
    } catch { throw new Error('Could not reach online bookmarks. Check your connection and try again.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        account.username = null; account.bookmarks = readLocal(); notify();
      }
      let message = result.error || 'Online bookmarks are unavailable. Please try again.';
      if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After'));
        if (seconds > 0) message += ' Next login available after ' + new Date(Date.now() + seconds * 1000).toLocaleString() + '.';
      }
      throw new Error(message);
    }
    return result;
  }
  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      const session = await api('/api/session');
      if (session.username !== account.username) account.bookmarks = [];
      account.username = session.username;
      account.bookmarks = account.username ? (await api('/api/bookmarks')).bookmarks : readLocal();
      status('');
    } catch (error) {
      if (!account.username) account.bookmarks = readLocal();
      status(error.message + (account.username ? '' : ' Showing bookmarks saved in this browser.'));
    } finally { account.loaded = true; setBusy(false); notify(); }
  }
  $('login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); status('Loading bookmarks…');
    try {
      const result = await api('/api/login', 'POST', { username: $('bookmark-name').value });
      account.username = result.username; account.bookmarks = []; notify();
      account.bookmarks = (await api('/api/bookmarks')).bookmarks;
      $('bookmark-name').value = '';
      status('Your online bookmarks are ready.'); notify();
      $('back-to-bookmarks').focus();
    } catch (error) { status(error.message); }
    finally { setBusy(false); }
  });
  $('logout')?.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/logout', 'POST');
      account.username = null; account.bookmarks = readLocal();
      status('Logged out. Your online bookmarks are still saved. New bookmarks will be saved in this browser.'); notify();
    } catch (error) { status(error.message); }
    finally { setBusy(false); }
  });
  $('import-local')?.addEventListener('click', async () => {
    if (busy || !account.username) return;
    setBusy(true);
    try {
      const local = readLocal().reverse();
      for (let i = 0; i < local.length; i++) {
        status(`Saving local bookmarks online (${i + 1} of ${local.length})…`);
        const { bookmark } = await api('/api/bookmarks', 'PUT', coordinates(local[i]));
        account.bookmarks = account.bookmarks.filter(m => !same(m, bookmark));
        account.bookmarks.unshift(bookmark);
        // Remove only after the server confirms this verse. Retries are idempotent.
        writeLocal(local[i], true); notify();
      }
      status('Your local bookmarks are now saved online.');
    } catch (error) { status(error.message + ' Bookmarks not transferred remain in this browser.'); }
    finally { setBusy(false); notify(); }
  });
  if ($('back-to-bookmarks')) {
    try {
      const back = new URL(new URLSearchParams(location.search).get('return') || '/#libbm', location.origin);
      $('back-to-bookmarks').href = back.origin === location.origin && ['/', '/bom/', '/ot/'].includes(back.pathname) ? back.pathname + back.hash : '/#libbm';
      if (back.origin === location.origin && ['/bom/', '/ot/'].includes(back.pathname) && back.hash !== '#bookmarks') $('back-to-bookmarks').textContent = '← Back to reading';
    } catch { $('back-to-bookmarks').href = '/#libbm'; }
  }
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  window.addEventListener('storage', event => {
    if (event.key?.endsWith('-abr:bookmarks')) {
      if (!account.username) account.bookmarks = readLocal();
      notify();
    }
  });
  account.ready = refresh();
})();
