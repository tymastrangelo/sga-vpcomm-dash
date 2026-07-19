import type { D1Database } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Locals {
			authed: boolean;
		}
		interface Platform {
			env: {
				DB: D1Database;
			};
		}
	}
}

export {};
