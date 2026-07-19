<script lang="ts">
	import { enhance } from '$app/forms';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import EntryModal from '$lib/components/EntryModal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { fmtDate, fmtTime } from '$lib/dates';
	import { PLATFORMS, type ContentItem } from '$lib/meta';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let editingProject = $state(false);
	let confirmingDelete = $state(false);
	let modal = $state<null | { content?: ContentItem }>(null);
</script>

<svelte:head><title>{data.project.name} — SGA Comms</title></svelte:head>

<a href="/projects" class="text-sm text-stone-500 hover:text-maroon">← Projects</a>

<div class="mt-2 rounded-lg border border-stone-200 bg-white p-5">
	{#if editingProject}
		<form
			method="POST"
			action="?/updateProject"
			use:enhance={() => async ({ update }) => {
				await update();
				editingProject = false;
			}}
			class="flex flex-wrap items-end gap-3"
		>
			<div class="min-w-48 flex-1">
				<label class="block text-sm font-medium text-stone-700" for="e-name">Name</label>
				<input
					id="e-name" name="name" required value={data.project.name}
					class="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:outline-none"
				/>
			</div>
			<div class="min-w-64 flex-[2]">
				<label class="block text-sm font-medium text-stone-700" for="e-desc">Description</label>
				<input
					id="e-desc" name="description" value={data.project.description ?? ''}
					class="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:outline-none"
				/>
			</div>
			<div>
				<span class="block text-sm font-medium text-stone-700">Color</span>
				<ColorPicker name="color" value={data.project.color ?? '#73000a'} tags={data.tags} allowNone={false} />
			</div>
			<button type="submit" class="rounded-md bg-maroon px-4 py-1.5 text-sm font-medium text-white hover:bg-maroon/90">Save</button>
			<button type="button" onclick={() => (editingProject = false)} class="text-sm text-stone-500 hover:underline">Cancel</button>
		</form>
	{:else}
		<div class="flex items-start justify-between gap-4">
			<div>
				<div class="flex items-center gap-2">
					<span class="size-3 rounded-full" style="background: {data.project.color ?? '#73000a'}"></span>
					<h1 class="text-lg font-semibold">{data.project.name}</h1>
				</div>
				{#if data.project.description}
					<p class="mt-1 text-sm text-stone-500">{data.project.description}</p>
				{/if}
			</div>
			<div class="flex shrink-0 gap-3 text-sm">
				<button type="button" onclick={() => (editingProject = true)} class="text-stone-500 hover:text-maroon">Edit</button>
				<button type="button" onclick={() => (confirmingDelete = !confirmingDelete)} class="text-red-600 hover:underline">Delete</button>
			</div>
		</div>

		{#if confirmingDelete}
			<div class="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-sm">
				<span class="text-red-800">
					Delete this project — what about its {data.items.length} item{data.items.length === 1 ? '' : 's'}?
				</span>
				<form method="POST" action="?/deleteProject" use:enhance>
					<input type="hidden" name="mode" value="cascade" />
					<button type="submit" class="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700">
						Delete items too
					</button>
				</form>
				<form method="POST" action="?/deleteProject" use:enhance>
					<input type="hidden" name="mode" value="keep" />
					<button type="submit" class="rounded-md border border-red-300 px-3 py-1 text-red-700 hover:bg-red-100">
						Keep as standalone posts
					</button>
				</form>
				<button type="button" onclick={() => (confirmingDelete = false)} class="text-stone-500 hover:underline">Cancel</button>
			</div>
		{/if}
	{/if}
</div>

<div class="mt-6 mb-3 flex items-center justify-between">
	<h2 class="text-sm font-semibold text-stone-700">Items in this series</h2>
	<button
		type="button"
		onclick={() => (modal = {})}
		class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90"
	>
		+ Add item to this series
	</button>
</div>

{#if data.items.length}
	<ul class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
		{#each data.items as item (item.id)}
			<li>
				<button
					type="button"
					onclick={() => (modal = { content: item })}
					class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-stone-50"
				>
					<span aria-hidden="true">{PLATFORMS[item.platform].icon}</span>
					<span class="min-w-0 flex-1 truncate">{item.title}</span>
					<span class="text-xs whitespace-nowrap text-stone-500">
						{#if item.post_date}
							{fmtDate(item.post_date)}{item.post_time ? ` · ${fmtTime(item.post_time)}` : ''}
						{:else}
							unscheduled
						{/if}
					</span>
					<StatusBadge status={item.status} />
				</button>
			</li>
		{/each}
	</ul>
{:else}
	<p class="text-sm text-stone-500">No items yet.</p>
{/if}

{#if modal}
	<EntryModal
		kind="content"
		content={modal.content ?? null}
		projects={data.projects}
		tags={data.tags}
		lockKind
		fixedProjectId={data.project.id}
		onclose={() => (modal = null)}
	/>
{/if}
