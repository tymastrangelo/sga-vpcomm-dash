import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, safeEqual, sessionToken } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const cookie = event.cookies.get(SESSION_COOKIE);
	event.locals.authed = !!cookie && safeEqual(cookie, await sessionToken());

	const isLogin = event.url.pathname === '/login';
	if (!event.locals.authed && !isLogin) redirect(302, '/login');
	if (event.locals.authed && isLogin) redirect(302, '/');

	return resolve(event);
};
