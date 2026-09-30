import catalog from './catalog.json';

const WEEK = 7 * 24 * 60 * 60 * 1000;
// Browsers cap persistent cookies; renew on visits without expiring the server session.
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
const COOKIE = '__Host-scripture-session';
const MAX_BOOKMARKS = 1000;
const encoder = new TextEncoder();

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
  }});
}
async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
function cookie(token, age = COOKIE_MAX_AGE) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
async function body(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, 'Send application/json.');
  }
  // Enforce the limit while streaming, even without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'A JSON object is required.');
  let size = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); throw new HttpError(413, 'Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'Invalid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'A JSON object is required.');
  return data;
}
function exactKeys(data, keys) {
  if (Object.keys(data).length !== keys.length || keys.some(k => !Object.hasOwn(data, k))) {
    throw new HttpError(400, `Only these fields are accepted: ${keys.join(', ')}.`);
  }
}
function validateBookmark(data) {
  exactKeys(data, ['volume', 'b', 'c', 'v']);
  const { volume, b, c, v } = data;
  if (typeof volume !== 'string' || !Object.hasOwn(catalog, volume) ||
      ![b, c, v].every(n => Number.isSafeInteger(n) && n >= 0) ||
      !(catalog[volume][b]?.chapters[c] > v)) {
    throw new HttpError(400, 'Choose an existing scripture verse.');
  }
  return data;
}
function describe(mark) {
  const book = catalog[mark.volume][mark.b];
  return { volume: mark.volume, b: mark.b, c: mark.c, v: mark.v, t: mark.created_at,
    ref: `${book.name} ${mark.c + 1}:${mark.v + 1}`,
    slug: `${book.slug}-${mark.c + 1}.${mark.v + 1}` };
}
async function session(request, db) {
  const token = request.headers.get('Cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await db.prepare('SELECT token_hash, username, owner FROM sessions WHERE token_hash = ?')
    .bind(await hash(token)).first();
  return row ? { ...row, token } : null;
}
async function login(request, db) {
  // CF-Connecting-IP is supplied by Cloudflare, never trust X-Forwarded-For.
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) throw new HttpError(400, 'Client IP is unavailable.');
  const now = Date.now(), ipHash = await hash('ip:' + ip);
  // One atomic SQL statement: simultaneous requests cannot pass the 100 limit.
  const admitted = await db.prepare(`INSERT INTO login_attempts(ip_hash, attempted_at)
    SELECT ?, ? WHERE (SELECT COUNT(*) FROM login_attempts WHERE ip_hash = ? AND attempted_at > ?) < 100
    RETURNING id`).bind(ipHash, now, ipHash, now - WEEK).first();
  if (!admitted) {
    const first = await db.prepare('SELECT MIN(attempted_at) AS oldest FROM login_attempts WHERE ip_hash = ? AND attempted_at > ?')
      .bind(ipHash, now - WEEK).first();
    return json({ error: 'This IP address has reached 100 login submissions in seven days. Try again later.' }, 429,
      { 'Retry-After': String(Math.max(1, Math.ceil((first.oldest + WEEK - now) / 1000))) });
  }
  const data = await body(request);
  exactKeys(data, ['username']);
  if (typeof data.username !== 'string') throw new HttpError(400, 'Enter a bookmark name.');
  const username = data.username.trim().normalize('NFC');
  if (!username || [...username].length > 64 || encoder.encode(username).length > 256 || /\p{C}/u.test(username)) {
    throw new HttpError(400, 'Use 1–64 visible characters for your bookmark name.');
  }
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
  const owner = await hash('username:' + username);
  const previous = await session(request, db);
  const statements = [db.prepare('INSERT INTO sessions(token_hash, username, owner) VALUES (?, ?, ?)')
    .bind(await hash(token), username, owner)];
  if (previous) statements.push(db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(previous.token_hash));
  await db.batch(statements);
  return json({ username }, 200, { 'Set-Cookie': cookie(token) });
}
async function api(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) throw new HttpError(405, 'Method not allowed.');
  if (method !== 'GET') {
    if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      throw new HttpError(403, 'Use this website to make changes.');
    }
  }
  if (path === '/api/login' && method === 'POST') return login(request, env.DB);
  const current = await session(request, env.DB);
  if (path === '/api/session' && method === 'GET') {
    return json({ username: current?.username ?? null }, 200, current ? { 'Set-Cookie': cookie(current.token) } : {});
  }
  if (path === '/api/logout' && method === 'POST') {
    if (current) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(current.token_hash).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  if (path !== '/api/bookmarks') throw new HttpError(404, 'Not found.');
  if (!current) throw new HttpError(401, 'Log in with your bookmark name first.');
  if (method === 'GET') {
    const { results } = await env.DB.prepare('SELECT volume, b, c, v, created_at FROM bookmarks WHERE owner = ? ORDER BY created_at DESC')
      .bind(current.owner).all();
    return json({ bookmarks: results.map(describe) });
  }
  if (!['PUT', 'DELETE'].includes(method)) throw new HttpError(405, 'Method not allowed.');
  const { volume, b, c, v } = validateBookmark(await body(request));
  if (method === 'DELETE') {
    await env.DB.prepare('DELETE FROM bookmarks WHERE owner = ? AND volume = ? AND b = ? AND c = ? AND v = ?')
      .bind(current.owner, volume, b, c, v).run();
    return json({ ok: true });
  }
  const saved = await env.DB.prepare(`INSERT INTO bookmarks(owner, volume, b, c, v, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE
    (SELECT COUNT(*) FROM bookmarks WHERE owner = ?) < ? OR
    EXISTS(SELECT 1 FROM bookmarks WHERE owner = ? AND volume = ? AND b = ? AND c = ? AND v = ?)
    ON CONFLICT(owner, volume, b, c, v) DO UPDATE SET created_at = bookmarks.created_at
    RETURNING volume, b, c, v, created_at`)
    .bind(current.owner, volume, b, c, v, Date.now(), current.owner, MAX_BOOKMARKS, current.owner, volume, b, c, v).first();
  if (!saved) throw new HttpError(409, 'This name has 1,000 bookmarks. Remove one before adding another.');
  return json({ bookmark: describe(saved) });
}
export default {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try { return await api(request, env); }
    catch (error) {
      // Never log names, cookies, IP addresses or request bodies.
      if (!(error instanceof HttpError)) console.error('Bookmark service failure');
      return json({ error: error instanceof HttpError ? error.message : 'Bookmark service is temporarily unavailable. Please try again.' }, error.status || 503);
    }
  },
  async scheduled(controller, env) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at <= ?').bind(now - WEEK),
    ]);
  },
};
