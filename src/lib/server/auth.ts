import { env } from '$env/dynamic/private';

export const SESSION_COOKIE = 'sga_session';

const enc = new TextEncoder();

// Single-user stateless session: the cookie value is HMAC(SESSION_SECRET, constant).
// Nothing to store server-side; rotating SESSION_SECRET invalidates all sessions.
export async function sessionToken(): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(env.SESSION_SECRET ?? ''),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode('sga-session-v1'));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a: string, b: string): boolean {
	const ab = enc.encode(a);
	const bb = enc.encode(b);
	if (ab.length !== bb.length) return false;
	let diff = 0;
	for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
	return diff === 0;
}
