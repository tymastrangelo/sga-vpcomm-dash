import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { SESSION_COOKIE, safeEqual, sessionToken } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');

		// ponytail: fixed 400ms delay is the whole brute-force story — single user, single password
		await new Promise((r) => setTimeout(r, 400));

		const ok =
			safeEqual(email, env.AUTH_USER ?? '') && safeEqual(password, env.AUTH_PASSWORD ?? '');
		if (!ok) return fail(400, { error: 'Wrong email or password.' });

		cookies.set(SESSION_COOKIE, await sessionToken(), {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30 // ~30 days
		});
		redirect(302, '/');
	}
};
