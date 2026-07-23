-- SGA-funded events that must have SGA-branded promo material approved.
-- Apply: npx wrangler d1 execute sga-calendar-db --local  --file=./migrations/002-funded-events.sql
--        npx wrangler d1 execute sga-calendar-db --remote --file=./migrations/002-funded-events.sql

CREATE TABLE IF NOT EXISTS funded_events (
	id INTEGER PRIMARY KEY,
	organization TEXT NOT NULL,
	description TEXT NOT NULL,
	event_date TEXT NOT NULL,   -- YYYY-MM-DD
	approved INTEGER NOT NULL DEFAULT 0,  -- promo material has SGA branding, checked off
	created_at TEXT NOT NULL
);
