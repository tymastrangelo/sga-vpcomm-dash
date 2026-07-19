-- Upgrade an existing database (one that already has data) to match schema.sql.
-- Fresh databases don't need this — schema.sql already includes these.
-- Apply: npx wrangler d1 execute sga-calendar-db --local  --file=./migrations/001-sidebar.sql
--        npx wrangler d1 execute sga-calendar-db --remote --file=./migrations/001-sidebar.sql

ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS links (
	id INTEGER PRIMARY KEY,
	title TEXT NOT NULL,
	url TEXT NOT NULL,
	created_at TEXT NOT NULL
);
