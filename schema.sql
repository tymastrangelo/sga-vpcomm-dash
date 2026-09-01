-- SGA Comms Content Calendar — schema + seed
-- Apply: npx wrangler d1 execute sga-calendar-db --local --file=./schema.sql
--        npx wrangler d1 execute sga-calendar-db --remote --file=./schema.sql

DROP TABLE IF EXISTS content_items;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS links;
DROP TABLE IF EXISTS funded_events;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS ig_media;
DROP TABLE IF EXISTS ig_day;
DROP TABLE IF EXISTS ig_audience;
DROP TABLE IF EXISTS ig_sync;

CREATE TABLE tasks (
	id INTEGER PRIMARY KEY,
	title TEXT NOT NULL,
	notes TEXT,
	due_date TEXT,              -- YYYY-MM-DD, NULL = "no date" (sidebar)
	due_time TEXT,              -- HH:MM, NULL = all-day / plain to-do; a time makes it an event
	location TEXT,              -- where it is, for events
	done INTEGER NOT NULL DEFAULT 0,
	done_at TEXT,               -- ISO timestamp when marked done
	is_recurring INTEGER NOT NULL DEFAULT 0,
	recur_interval TEXT,        -- 'weekly' | 'monthly'
	recur_anchor TEXT,          -- weekly: day-of-week 0-6; monthly: day-of-month 1-28
	color TEXT,                 -- hex
	sort_order INTEGER NOT NULL DEFAULT 0,  -- manual drag order in the sidebar (lower = higher)
	created_at TEXT NOT NULL
);

CREATE TABLE projects (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT,
	color TEXT,
	created_at TEXT NOT NULL
);

CREATE TABLE content_items (
	id INTEGER PRIMARY KEY,
	project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
	title TEXT NOT NULL,
	notes TEXT,
	post_date TEXT,             -- YYYY-MM-DD, nullable (unscheduled idea)
	post_time TEXT,             -- HH:MM, nullable
	platform TEXT NOT NULL DEFAULT 'other',  -- instagram|tiktok|youtube|website|moseley_tv|email|other
	status TEXT NOT NULL DEFAULT 'idea',     -- idea|in_progress|scheduled|posted
	created_at TEXT NOT NULL
);

CREATE TABLE tags (
	id INTEGER PRIMARY KEY,
	key TEXT UNIQUE NOT NULL,
	label TEXT NOT NULL,
	color TEXT NOT NULL
);

CREATE TABLE links (
	id INTEGER PRIMARY KEY,
	title TEXT NOT NULL,
	url TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE funded_events (
	id INTEGER PRIMARY KEY,
	organization TEXT NOT NULL,
	description TEXT NOT NULL,
	event_date TEXT NOT NULL,   -- YYYY-MM-DD
	approved INTEGER NOT NULL DEFAULT 0,  -- promo material has SGA branding, checked off
	created_at TEXT NOT NULL
);

-- Generic key/value config. Holds the IG token/user id so the nightly worker can
-- read them too, and so a refreshed token can be persisted without a redeploy.
CREATE TABLE IF NOT EXISTS app_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- One row per post / reel / carousel / story. Typed columns for the metrics we
-- chart; metrics_json keeps every raw value the API returned so a post's full
-- detail view works no matter which metrics its format supports.
CREATE TABLE IF NOT EXISTS ig_media (
	id TEXT PRIMARY KEY,
	media_type TEXT,                -- IMAGE | VIDEO | CAROUSEL_ALBUM
	product_type TEXT,              -- FEED | REELS | STORY | AD
	format TEXT,                    -- image | carousel | reel | video | story (derived)
	caption TEXT,
	permalink TEXT,
	media_url TEXT,
	thumbnail_url TEXT,
	timestamp TEXT,                 -- ISO 8601, as returned by the API
	posted_date TEXT,               -- YYYY-MM-DD in America/New_York
	posted_hour INTEGER,            -- 0-23 in America/New_York
	posted_dow INTEGER,             -- 0 = Sunday, in America/New_York
	children_count INTEGER NOT NULL DEFAULT 0,
	like_count INTEGER,
	comments_count INTEGER,
	reach INTEGER,
	views INTEGER,
	saved INTEGER,
	shares INTEGER,
	total_interactions INTEGER,
	follows INTEGER,
	profile_visits INTEGER,
	replies INTEGER,
	navigation INTEGER,
	link_clicks INTEGER,
	reposts INTEGER,
	avg_watch_time INTEGER,         -- ms
	total_watch_time INTEGER,       -- ms
	metrics_json TEXT,              -- { metric: value | {breakdown: {...}} }
	insights_at TEXT,               -- last successful insights fetch, ISO
	fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ig_media_ts ON ig_media(timestamp DESC);
CREATE INDEX IF NOT EXISTS ig_media_format ON ig_media(format, posted_date);

-- One row per calendar day (ET). followers/media_count are point-in-time
-- snapshots; the rest are that day's totals from account insights.
CREATE TABLE IF NOT EXISTS ig_day (
	date TEXT PRIMARY KEY,          -- YYYY-MM-DD
	followers INTEGER,
	follows_count INTEGER,
	media_count INTEGER,
	reach INTEGER,
	views INTEGER,
	total_interactions INTEGER,
	likes INTEGER,
	comments INTEGER,
	shares INTEGER,
	saves INTEGER,
	replies INTEGER,
	reposts INTEGER,
	accounts_engaged INTEGER,
	profile_links_taps INTEGER,
	follows_gained INTEGER,
	unfollows INTEGER,
	metrics_json TEXT,
	fetched_at TEXT NOT NULL
);

-- Latest demographics snapshot: one row per (breakdown, bucket).
CREATE TABLE IF NOT EXISTS ig_audience (
	breakdown TEXT NOT NULL,        -- age | gender | country | city
	bucket TEXT NOT NULL,           -- "25-34" | "F" | "US" | "Burlington, North Carolina"
	value INTEGER NOT NULL,
	fetched_at TEXT NOT NULL,
	PRIMARY KEY (breakdown, bucket)
);

CREATE TABLE IF NOT EXISTS ig_sync (
	id INTEGER PRIMARY KEY,
	started_at TEXT NOT NULL,
	finished_at TEXT,
	ok INTEGER NOT NULL DEFAULT 0,
	media_seen INTEGER NOT NULL DEFAULT 0,
	media_refreshed INTEGER NOT NULL DEFAULT 0,
	days_synced INTEGER NOT NULL DEFAULT 0,
	calls INTEGER NOT NULL DEFAULT 0,
	message TEXT
);

-- ---------- seed ----------

INSERT INTO tags (key, label, color) VALUES
	('sga_content', 'SGA Content', '#B59A57'),
	('recurring_check', 'Recurring Check', '#73000A'),
	('oneoff', 'One-off Task', '#475569');

-- Recurring weekly check-ins (due dates = next matching day from build date 2026-07-18)
INSERT INTO tasks (title, due_date, is_recurring, recur_interval, recur_anchor, color, created_at) VALUES
	('Post weekly meeting Instagram story', '2026-07-23', 1, 'weekly', '4', '#73000A', '2026-07-18T00:00:00Z'),
	('Business-meeting-in-60-seconds recap', '2026-07-23', 1, 'weekly', '4', '#73000A', '2026-07-18T00:00:00Z'),
	('Check PhoenixCONNECT for new funding approvals to send brand emails', '2026-07-20', 1, 'weekly', '1', '#73000A', '2026-07-18T00:00:00Z'),
	('Update SGA website (bios, calendar, press releases)', '2026-07-20', 1, 'weekly', '1', '#73000A', '2026-07-18T00:00:00Z'),
	('Repost SGA-sponsored club events (check tags)', '2026-07-24', 1, 'weekly', '5', '#73000A', '2026-07-18T00:00:00Z');

-- Newsletter dates as dated tasks (tag sga_content → gold)
INSERT INTO tasks (title, due_date, color, created_at) VALUES
	('Alumni Newsletter #1 (intro) — send to Dyamond', '2026-08-11', '#B59A57', '2026-07-18T00:00:00Z'),
	('Alumni Newsletter #2 (fall recap) — send to Dyamond', '2027-01-26', '#B59A57', '2026-07-18T00:00:00Z'),
	('Alumni Newsletter #3 (year-end) — send to Dyamond', '2027-05-18', '#B59A57', '2026-07-18T00:00:00Z');

-- Standalone content ideas (no date yet)
INSERT INTO content_items (title, platform, status, created_at) VALUES
	('Meet the Exec Board post', 'instagram', 'idea', '2026-07-18T00:00:00Z'),
	('What does SGA do? explainer', 'instagram', 'idea', '2026-07-18T00:00:00Z');

-- Seed content project with nested items
INSERT INTO projects (name, description, color, created_at) VALUES
	('Guider''s Guide to Campus Safety', '3-part campus safety video series with Chris Guider.', '#73000A', '2026-07-18T00:00:00Z');

INSERT INTO content_items (project_id, title, post_date, platform, status, created_at) VALUES
	(1, 'Episode 1 — Fall', '2026-09-08', 'youtube', 'idea', '2026-07-18T00:00:00Z'),
	(1, 'Episode 2 — Winter/J-Term', NULL, 'youtube', 'idea', '2026-07-18T00:00:00Z'),
	(1, 'Episode 3 — Spring', NULL, 'youtube', 'idea', '2026-07-18T00:00:00Z');
