import type { D1Database } from '@cloudflare/workers-types';

export function db(platform: Readonly<App.Platform> | undefined): D1Database {
	const d1 = platform?.env?.DB;
	if (!d1) {
		throw new Error(
			'D1 binding "DB" missing. Local dev: apply schema with `npx wrangler d1 execute sga-calendar-db --local --file=./schema.sql` and run `npm run dev`.'
		);
	}
	return d1;
}
