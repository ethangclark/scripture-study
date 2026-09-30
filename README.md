# Scripture study

Read the abridged or full Book of Mormon and Old Testament at
**https://scripture-study.scripture-study.workers.dev**.

## Bookmark names

Visit **Bookmark login** from a bookmarks page to choose a name and save verses
across sessions and devices. Signed-out readers can save bookmarks locally without
logging in; a notice appears once per browser on the first local save. There is no
password, identity verification, or account recovery. **Anyone entering the same
name can read and change its bookmarks.** Names are case-sensitive, trimmed, and
Unicode NFC-normalized; they must contain 1–64 visible characters (at most 256 UTF-8
bytes). Do not use personal information or a password used elsewhere.

Sessions have no server-side expiration and use random, opaque `HttpOnly`, `Secure`, `SameSite=Strict`
cookies, renewed on visits. Browsers may still clear cookies; entering the same name
restores its bookmarks. Logging out revokes that session and keeps the bookmarks. Each IP address
may submit at most 100 logins in any rolling seven days, including malformed
same-origin submissions. Requests after the limit return HTTP 429 and `Retry-After`.
Session restoration, reading, and bookmark writes do not consume logins. Shared
networks share the IP allowance; this is an IP limit, not a per-person limit.

## Cloudflare deployment

The project uses Workers Static Assets for the reader and a Worker with D1 for
sessions, login limits, and bookmarks. It is deployed on the **Workers Free plan**.
No paid plan is required. Free-tier capacity limits still apply; if exhausted,
the bookmark API can be unavailable until quotas reset. See the official
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

The existing account, Worker name and database binding are in `wrangler.jsonc`.
The Cloudflare account login is **ethangclark@gmail.com**.
These IDs and the login email are not credentials. Local deployments use Wrangler's
saved OAuth login; GitHub Actions uses the repository secret `CLOUDFLARE_API_TOKEN`.
No credentials belong in Git.

Every push to `main` automatically deploys after the tests and deployment bundle
check pass. The workflow applies pending D1 migrations, deploys the Worker and
assets, then checks the public endpoints. Production deployments run one at a time.
Pull requests and other branches run checks only. To redeploy `main` manually,
run **Check and deploy Cloudflare reader** from GitHub Actions. The old GitHub Pages
workflow is replaced because Pages cannot run the bookmark API.

For local development or a manual deployment, use Node.js 22 or newer and Python 3.
From the repository root:

```sh
npm ci
npx wrangler login
npm run deploy
```

Deploy builds both readers and the compact server-side verse catalogue, applies
pending D1 migrations, and uploads the Worker and static assets together. Redeploys
preserve the database. An hourly scheduled handler deletes expired login attempts; bookmarks remain until explicitly removed.

To deploy to another account, change `account_id`, run
`npx wrangler d1 create scripture-study`, and copy its database ID to
`wrangler.jsonc` before deploying.

## Development and verification

```sh
npm run dev
npm test
node tests/smoke.js https://scripture-study.scripture-study.workers.dev
```

`npm run dev` builds the reader, migrates a separate local D1 database, and starts
Wrangler at localhost. `npm test` runs integration tests against the Workers runtime
and actual local D1 SQL, including concurrent login/cap enforcement, cross-session
persistence, identity isolation, invalid payloads, CSRF, and persistent-session migration/renewal.
The optional deployed smoke test consumes three login submissions, uses randomly
named test collections, and removes its test bookmarks and sessions afterward.

## Storage and validation

Bookmark mutations accept exactly `{volume, b, c, v}`: `bom` or `ot`, followed by
zero-based integer book/chapter/verse indices. The Worker validates every coordinate
against a catalogue generated from the same scripture files as the reader. Unknown
fields, text, URLs, notes, supplied labels/timestamps, impossible verses, malformed
JSON, and bodies over 1 KiB are rejected. Labels, links, and timestamps are generated
by the server. Each name is limited to 1,000 unique bookmarks; writes are idempotent
and capped atomically. Per-verse mutations avoid overwriting another device's entire
bookmark collection.

Requests are scoped to the server session, use parameterized SQL, and mutations
require the site's own Origin. Rate limits use Cloudflare's `CF-Connecting-IP`, not
client-supplied forwarding headers. D1 stores hashes of IP addresses and session
tokens; session names are bounded strings and bookmark owners are hashed names.
IP/name hashing does not make guessable names or addresses secret. The app does not
log login names, IPs, cookies, or bookmark payloads.

Reading preferences and the last chapter stay local to the browser. Local bookmarks
use the original per-volume browser storage keys and are validated against the
scripture catalogue. After login, the dedicated login page offers an explicit
**Save local bookmarks online** action. Each bookmark is removed locally only after
the server confirms it; partial failures preserve remaining local bookmarks.
Logging out returns to the local collection without copying online bookmarks into
it. Browser data from a different origin cannot be imported automatically. The supported online build is `npm run build`
(`reader/_site`); serve it through the Worker so `/api/*` is available.
