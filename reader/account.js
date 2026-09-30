(() => {
  const $ = id => document.getElementById(id);
  let busy = false;
  const account = window.ScriptureAccount = {
    username: null,
    bookmarks: [],
    prompt() {
      $('login-panel').open = true;
      $('bookmark-name').focus();
      $('login-panel').scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    async change(mark, removing) {
      if (busy) throw new Error('Please wait for the current bookmark request.');
      setBusy(true);
      try {
        const data = await api('/api/bookmarks', removing ? 'DELETE' : 'PUT', mark);
        account.bookmarks = account.bookmarks.filter(m => !['volume', 'b', 'c', 'v'].every(k => m[k] === mark[k]));
        if (!removing) account.bookmarks.unshift(data.bookmark);
        notify();
        status('Saved online.');
      } catch (error) {
        status(error.message + ' Your change was not confirmed; retry to check.');
        throw error;
      } finally { setBusy(false); }
    },
  };
  function status(text) { $('account-status').textContent = text; }
  function setBusy(value) {
    busy = value;
    for (const id of ['login-submit', 'logout', 'bookmark-name']) $(id).disabled = value;
  }
  function notify() {
    $('account-current').hidden = !account.username;
    $('account-name').textContent = account.username || '';
    $('account-summary').textContent = account.username ? 'Switch bookmark name · How this works' : 'Log in to save bookmarks';
    window.dispatchEvent(new Event('bookmarkschange'));
  }
  async function api(path, method = 'GET', data) {
    let response;
    try {
      response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
        headers: data ? { 'Content-Type': 'application/json' } : {},
        body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(15000) });
    } catch { throw new Error('Could not reach bookmark storage. Check your connection and try again.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        account.username = null; account.bookmarks = []; notify(); account.prompt();
      }
      let message = result.error || 'Bookmark storage is unavailable. Please try again.';
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
      // Clear the previous name's marks before fetching the next name's data.
      account.username = session.username;
      account.bookmarks = [];
      notify();
      if (account.username) account.bookmarks = (await api('/api/bookmarks')).bookmarks;
      notify();
      status(account.username ? 'Bookmarks synced online.' : 'Read freely. Log in to save bookmarks across visits and devices.');
    } catch (error) { status(error.message); }
    finally { setBusy(false); }
  }
  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); status('Loading bookmarks…');
    try {
      const result = await api('/api/login', 'POST', { username: $('bookmark-name').value });
      account.username = result.username; account.bookmarks = []; notify();
      account.bookmarks = (await api('/api/bookmarks')).bookmarks;
      $('bookmark-name').value = '';
      $('login-panel').open = false;
      notify(); status('Bookmarks synced online.');
    } catch (error) { status(error.message); }
    finally { setBusy(false); }
  });
  $('logout').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/logout', 'POST');
      account.username = null; account.bookmarks = []; notify();
      $('login-panel').open = false;
      status('Logged out. Your bookmarks are saved online for the next time you enter that name.');
    } catch (error) { status(error.message); }
    finally { setBusy(false); }
  });
  // Refresh on tab return and bfcache restoration; this never submits another login.
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  account.ready = refresh();
})();
