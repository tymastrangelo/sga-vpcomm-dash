<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	// Lucide icon paths (24x24 stroke), inlined so the tab bar needs no icon dependency.
	const nav = [
		{
			href: '/',
			label: 'Calendar',
			icon: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'
		},
		{
			href: '/projects',
			label: 'Projects',
			icon: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'
		},
		{
			href: '/funded',
			label: 'Funded',
			icon: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>'
		},
		{
			href: '/settings',
			label: 'Settings',
			icon: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'
		}
	];

	const isLogin = $derived(page.url.pathname === '/login');
	function active(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isLogin}
	{@render children()}
{:else}
	<div class="min-h-screen bg-stone-50 text-stone-900">
		<!-- Top header: full nav on desktop, slim brand bar on mobile -->
		<header class="border-b border-stone-200 bg-white pt-[env(safe-area-inset-top)]">
			<div class="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
				<a href="/" class="text-base font-semibold text-maroon">SGA Comms</a>
				<nav class="hidden flex-1 items-center gap-1 text-sm lg:flex">
					{#each nav as { href, label } (href)}
						<a
							{href}
							class="rounded-md px-3 py-1.5 hover:bg-stone-100 {active(href)
								? 'font-medium text-maroon'
								: 'text-stone-600'}"
						>
							{label}
						</a>
					{/each}
				</nav>
				<form method="POST" action="/logout" class="ml-auto hidden lg:block">
					<button type="submit" class="text-sm text-stone-500 hover:text-maroon">Log out</button>
				</form>
			</div>
		</header>

		<main class="mx-auto max-w-7xl px-4 py-6 pb-28 lg:pb-6">
			{@render children()}
		</main>

		<!-- Bottom tab bar, mobile only -->
		<nav
			class="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
			aria-label="Primary"
		>
			<div class="mx-auto flex max-w-md items-stretch">
				{#each nav as { href, label, icon } (href)}
					<a
						{href}
						class="flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium
							{active(href) ? 'text-maroon' : 'text-stone-400'}"
						aria-current={active(href) ? 'page' : undefined}
					>
						<svg
							viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							stroke-linecap="round" stroke-linejoin="round" class="size-6" aria-hidden="true"
						>
							{@html icon}
						</svg>
						{label}
					</a>
				{/each}
			</div>
		</nav>
	</div>
{/if}
