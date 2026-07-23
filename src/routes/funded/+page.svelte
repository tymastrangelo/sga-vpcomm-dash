<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtDate, todayET } from '$lib/dates';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let importing = $state(false);
	let adding = $state(false);

	const today = todayET();
	const upcoming = $derived(data.events.filter((e) => e.event_date >= today));
	const past = $derived(data.events.filter((e) => e.event_date < today).reverse());
	const pending = $derived(upcoming.filter((e) => !e.approved).length);
</script>

<svelte:head><title>Funded Events — SGA Comms</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-lg font-semibold">SGA-Funded Events</h1>
	{#if pending}
		<span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
			{pending} awaiting branding approval
		</span>
	{/if}
	<div class="ml-auto flex gap-2">
		<button
			type="button"
			onclick={() => { adding = !adding; importing = false; }}
			class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100"
		>
			{adding ? 'Cancel' : '+ Add one'}
		</button>
		<button
			type="button"
			onclick={() => { importing = !importing; adding = false; }}
			class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90"
		>
			{importing ? 'Cancel' : 'Paste from email'}
		</button>
	</div>
</div>

<p class="mb-4 text-sm text-stone-500">
	Events with SGA funding must show SGA branding on posters and promo material. Check off each event
	once its promo has been approved.
</p>

{#if form?.error}
	<p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{/if}
{#if form?.ok && 'imported' in form}
	<p class="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
		Imported {form.imported} event{form.imported === 1 ? '' : 's'}{form.skipped
			? ` (${form.skipped} already in the list)`
			: ''}.
	</p>
{/if}

{#if importing}
	<form
		method="POST"
		action="?/importEvents"
		use:enhance={() => async ({ update }) => {
			await update();
			importing = false;
		}}
		class="mb-6 rounded-lg border border-stone-200 bg-white p-4"
	>
		<label class="block text-sm font-medium text-stone-700" for="fe-paste">
			Paste the event list from the email
		</label>
		<p class="mt-0.5 text-xs text-stone-500">
			Select the table in the email (Organization / Event / Date rows), copy, paste here. The
			signature and headers are ignored, and events already in the list are skipped.
		</p>
		<textarea
			id="fe-paste" name="text" rows="8" required
			class="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs focus:border-maroon focus:outline-none"
			placeholder={'College Republicans\tEOY Cookout\t5/4/2026\nElon Yoga Club\tYoga\t5/4/2026'}
		></textarea>
		<button type="submit" class="mt-3 rounded-md bg-maroon px-4 py-1.5 text-sm font-medium text-white hover:bg-maroon/90">
			Import
		</button>
	</form>
{/if}

{#if adding}
	<form
		method="POST"
		action="?/addEvent"
		use:enhance={() => async ({ update }) => {
			await update();
			adding = false;
		}}
		class="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-4"
	>
		<div class="min-w-48 flex-1">
			<label class="block text-sm font-medium text-stone-700" for="fe-org">Organization</label>
			<input id="fe-org" name="organization" required
				class="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:outline-none" />
		</div>
		<div class="min-w-48 flex-1">
			<label class="block text-sm font-medium text-stone-700" for="fe-desc">Event</label>
			<input id="fe-desc" name="description" required
				class="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:outline-none" />
		</div>
		<div>
			<label class="block text-sm font-medium text-stone-700" for="fe-date">Date</label>
			<input id="fe-date" name="event_date" type="date" required
				class="mt-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:outline-none" />
		</div>
		<button type="submit" class="rounded-md bg-maroon px-4 py-1.5 text-sm font-medium text-white hover:bg-maroon/90">
			Add
		</button>
	</form>
{/if}

{#snippet eventRows(events: typeof data.events, dim: boolean)}
	{#each events as event (event.id)}
		<tr class="border-t border-stone-100 {dim ? 'opacity-50' : ''}">
			<td class="py-2 pl-4 pr-2">
				<form method="POST" action="?/toggleApproved" use:enhance class="inline-flex">
					<input type="hidden" name="id" value={event.id} />
					<button
						type="submit"
						aria-label={event.approved ? 'Mark branding not approved' : 'Mark branding approved'}
						class="grid size-5 shrink-0 place-items-center rounded border text-xs leading-none
							{event.approved ? 'border-green-600 bg-green-600 text-white' : 'border-stone-400 bg-white text-transparent hover:border-maroon'}"
					>
						✓
					</button>
				</form>
			</td>
			<td class="px-2 py-2 font-medium">{event.organization}</td>
			<td class="px-2 py-2 text-stone-600">{event.description}</td>
			<td class="whitespace-nowrap px-2 py-2 text-stone-500">{fmtDate(event.event_date, today)}</td>
			<td class="py-2 pl-2 pr-4 text-right">
				<form method="POST" action="?/deleteEvent" use:enhance class="inline-flex">
					<input type="hidden" name="id" value={event.id} />
					<button type="submit" aria-label="Delete event" class="text-stone-400 hover:text-red-600">✕</button>
				</form>
			</td>
		</tr>
	{/each}
{/snippet}

{#if data.events.length}
	<div class="overflow-x-auto rounded-lg border border-stone-200 bg-white">
		<table class="w-full text-sm">
			<thead>
				<tr class="text-left text-xs uppercase tracking-wide text-stone-500">
					<th class="py-2 pl-4 pr-2 font-medium" title="Branding approved">✓</th>
					<th class="px-2 py-2 font-medium">Organization</th>
					<th class="px-2 py-2 font-medium">Event</th>
					<th class="px-2 py-2 font-medium">Date</th>
					<th class="py-2 pl-2 pr-4"></th>
				</tr>
			</thead>
			<tbody>
				{@render eventRows(upcoming, false)}
				{#if past.length}
					<tr class="border-t border-stone-200 bg-stone-50">
						<td colspan="5" class="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
							Past events
						</td>
					</tr>
					{@render eventRows(past, true)}
				{/if}
			</tbody>
		</table>
	</div>
{:else}
	<p class="text-sm text-stone-500">
		No funded events yet. Paste the list from the weekly email to get started.
	</p>
{/if}
