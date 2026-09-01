// Standalone Worker on a cron trigger: keeps Instagram stats fresh and sends the
// daily ntfy digest. Deploy: npm run deploy:notifier
// It shares the D1 database and both bits of logic with the main app.
import type { D1Database } from '@cloudflare/workers-types';
import { todayET } from '../src/lib/dates';
import { buildDigest, sendNtfy } from '../src/lib/server/notify';
import { loadConfig, syncInstagram } from '../src/lib/server/instagram';

interface Env {
	DB: D1Database;
	NTFY_TOPIC: string;
	IG_ACCESS_TOKEN?: string;
	IG_USER_ID?: string;
	IG_API_BASE?: string;
}

const DIGEST_HOUR_UTC = 12; // 8:00 AM EDT / 7:00 AM EST

export default {
	async scheduled(event: { scheduledTime: number }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
		ctx.waitUntil(
			(async () => {
				// Every run syncs Instagram. Four-hourly matters because story
				// insights vanish 24h after posting — a once-a-day sync misses most
				// of them — and because each run's call budget is capped, so a big
				// back catalogue fills in across runs.
				const cfg = await loadConfig(env.DB, env);
				if (cfg) await syncInstagram(env.DB, cfg, { days: 90 });

				if (new Date(event.scheduledTime).getUTCHours() === DIGEST_HOUR_UTC) {
					const digest = await buildDigest(env.DB, todayET());
					await sendNtfy(env.NTFY_TOPIC, digest);
				}
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
