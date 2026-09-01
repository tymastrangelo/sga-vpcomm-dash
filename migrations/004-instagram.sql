-- Instagram stats dashboard: config, post-level metrics, daily account metrics,
-- audience demographics, and a sync log.
-- Apply: npx wrangler d1 execute sga-calendar-db --local --file=./migrations/004-instagram.sql
--        npx wrangler d1 execute sga-calendar-db --remote --file=./migrations/004-instagram.sql

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
