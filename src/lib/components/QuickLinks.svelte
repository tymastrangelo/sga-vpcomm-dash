<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Link } from '$lib/meta';

	let { links }: { links: Link[] } = $props();
	let error = $state('');

	const submit = () => {
		error = '';
		return async ({ result, update }: any) => {
			if (result.type === 'failure') error = result.data?.error ?? 'Could not add link.';
			await update();
		};
	};
</script>

<div class="rounded-lg border border-stone-200 bg-white p-4">
	<h2 class="text-sm font-semibold text-stone-700">Quick Links</h2>

	{#if links.length}
		<ul class="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
			{#each links as link (link.id)}
				<li class="flex items-center gap-2 text-sm">
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						class="min-w-0 flex-1 truncate text-maroon hover:underline"
						title={link.url}
					>
						🔗 {link.title}
					</a>
					<form
						method="POST"
						action="/?/deleteLink"
						use:enhance
						onsubmit={(e) => !confirm(`Remove link "${link.title}"?`) && e.preventDefault()}
						class="inline-flex"
					>
						<input type="hidden" name="id" value={link.id} />
						<button type="submit" aria-label={`Remove link "${link.title}"`} class="px-1 text-stone-300 hover:text-red-600">✕</button>
					</form>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-2 text-xs text-stone-400">Add links you use all the time — PhoenixCONNECT, drive folders, anything.</p>
	{/if}

	{#if error}
		<p class="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
	{/if}

	<form method="POST" action="/?/createLink" use:enhance={submit} class="mt-3 space-y-1.5">
		<input
			name="title"
			required
			placeholder="Title"
			autocomplete="off"
			class="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none"
		/>
		<div class="flex gap-1.5">
			<input
				name="url"
				required
				placeholder="URL"
				autocomplete="off"
				class="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none"
			/>
			<button type="submit" class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90">
				Add
			</button>
		</div>
	</form>
</div>
