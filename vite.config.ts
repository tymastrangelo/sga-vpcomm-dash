import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Declared rather than pulling in @types/node for one env lookup.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				// D1 is marked `remote = true` in wrangler.toml, so dev reads the live
				// database. LOCAL_DB=1 (npm run dev:local) opts back out.
				platformProxy: { remoteBindings: process.env.LOCAL_DB !== '1' }
			})
		})
	]
});
