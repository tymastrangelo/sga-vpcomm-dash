// Standalone Worker that sends the daily ntfy digest on a cron trigger.
// Deploy: npm run deploy:notifier
// It shares the D1 database and the digest code with the main app.
import type { D1Database } from '@cloudflare/workers-types';
import { todayET } from '../src/lib/dates';
import { buildDigest, sendNtfy } from '../src/lib/server/notify';

interface Env {
	DB: D1Database;
	NTFY_TOPIC: string;
}

export default {
	async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
		ctx.waitUntil(
			(async () => {
				const digest = await buildDigest(env.DB, todayET());
				await sendNtfy(env.NTFY_TOPIC, digest);
			})()
		);
	},

	// No manual-send endpoint here on purpose: the Worker URL is public, and the
	// "Send test notification" button in the app's Settings covers manual sends.
	async fetch(): Promise<Response> {
		return new Response('sga-calendar-notifier: scheduled worker, nothing to see here.', {
			status: 200
		});
	}
};
