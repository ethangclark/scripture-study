CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE INDEX login_attempts_ip_time ON login_attempts(ip_hash, attempted_at);
CREATE INDEX login_attempts_expiry ON login_attempts(attempted_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL CHECK(length(username) BETWEEN 1 AND 64),
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE bookmarks (
  owner TEXT NOT NULL,
  volume TEXT NOT NULL CHECK(volume IN ('bom', 'ot')),
  b INTEGER NOT NULL CHECK(b >= 0),
  c INTEGER NOT NULL CHECK(c >= 0),
  v INTEGER NOT NULL CHECK(v >= 0),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(owner, volume, b, c, v)
) WITHOUT ROWID;
