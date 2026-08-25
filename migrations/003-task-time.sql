-- Time-of-day on a task, which is what turns a task into an event you attend
-- ("Breakfast w/ Connie Book, 8:30 AM"). Untimed tasks stay untimed.
-- Apply: npx wrangler d1 execute sga-calendar-db --local  --file=./migrations/003-task-time.sql
--        npx wrangler d1 execute sga-calendar-db --remote --file=./migrations/003-task-time.sql

ALTER TABLE tasks ADD COLUMN due_time TEXT;   -- HH:MM, NULL = all-day / plain to-do
ALTER TABLE tasks ADD COLUMN location TEXT;   -- where it is, for events
