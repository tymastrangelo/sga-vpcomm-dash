// Smallest check that fails if the email-paste parser breaks.
// Run: node scripts/check-parse-funded.ts
import assert from 'node:assert/strict';
import { parseFundedEvents } from '../src/lib/parseFunded.ts';

// Tab-separated (Outlook table copy), with header row
const tabbed = parseFundedEvents(
	'Organization\tEvent Description\tEvent Date\n' +
		'College Republicans\tEOY Cookout\t5/4/2026\n' +
		'Elon Yoga Club\tYoga\t5/4/2026\n'
);
assert.deepEqual(tabbed, [
	{ organization: 'College Republicans', description: 'EOY Cookout', event_date: '2026-05-04' },
	{ organization: 'Elon Yoga Club', description: 'Yoga', event_date: '2026-05-04' }
]);

// One cell per line, headers, blank lines, and a signature to ignore
const lines = parseFundedEvents(`Organization
Event Description
Event Date
Relay for Life: Colleges Against Cancer
Race for Hope
5/10/2026

—
Jackie Allred
Administrative Assistant for Student Life
Office (336) 278-7109
jallred@elon.edu`);
assert.deepEqual(lines, [
	{
		organization: 'Relay for Life: Colleges Against Cancer',
		description: 'Race for Hope',
		event_date: '2026-05-10'
	}
]);

// Garbage in → nothing out
assert.deepEqual(parseFundedEvents('hello\nworld'), []);

console.log('check-parse-funded: all assertions passed');
