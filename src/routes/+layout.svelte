<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Calendar' },
		{ href: '/projects', label: 'Projects' },
		{ href: '/settings', label: 'Settings' }
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
		<header class="border-b border-stone-200 bg-white">
			<div class="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
				<a href="/" class="text-base font-semibold text-maroon">SGA Comms</a>
				<nav class="flex flex-1 items-center gap-1 text-sm">
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
				<form method="POST" action="/logout">
					<button type="submit" class="text-sm text-stone-500 hover:text-maroon">Log out</button>
				</form>
			</div>
		</header>
		<main class="mx-auto max-w-7xl px-4 py-6">
			{@render children()}
		</main>
	</div>
{/if}
