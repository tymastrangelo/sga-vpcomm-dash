// Smallest check that fails if the recurrence/grid date math breaks.
// Run: node scripts/check-dates.ts
import assert from 'node:assert/strict';
import { addDays, addMonths, monthGridRange, nextDueDate } from '../src/lib/dates.ts';

assert.equal(addDays('2026-07-31', 1), '2026-08-01');
assert.equal(addDays('2026-02-28', 1), '2026-03-01'); // not a leap year

// weekly = +7 days, weekday preserved
assert.equal(nextDueDate('2026-07-20', 'weekly', '1'), '2026-07-27');
assert.equal(nextDueDate('2026-12-29', 'weekly', '2'), '2027-01-05'); // year rollover

// monthly = same day next month, clamped to 28 (Feb-proof)
assert.equal(nextDueDate('2026-07-15', 'monthly', '15'), '2026-08-15');
assert.equal(nextDueDate('2026-12-28', 'monthly', '28'), '2027-01-28'); // year rollover
assert.equal(nextDueDate('2026-01-28', 'monthly', '28'), '2026-02-28'); // Feb works
assert.equal(nextDueDate('2026-01-31', 'monthly', '31'), '2026-02-28'); // clamp guard

assert.equal(addMonths('2026-12', 1), '2027-01');
assert.equal(addMonths('2026-01', -1), '2025-12');

// July 2026: 1st is a Wednesday, 31st is a Friday → Sun Jun 28 .. Sat Aug 1
assert.deepEqual(monthGridRange('2026-07'), { start: '2026-06-28', end: '2026-08-01' });
// Feb 2026: 1st is a Sunday, 28th is a Saturday → exact month
assert.deepEqual(monthGridRange('2026-02'), { start: '2026-02-01', end: '2026-02-28' });

console.log('check-dates: all assertions passed');
