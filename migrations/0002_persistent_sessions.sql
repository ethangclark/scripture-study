DROP INDEX sessions_expiry;
ALTER TABLE sessions DROP COLUMN expires_at;
