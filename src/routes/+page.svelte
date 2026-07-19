<script lang="ts">
	import { browser } from '$app/environment';
	import Agenda from '$lib/components/Agenda.svelte';
	import DayModal from '$lib/components/DayModal.svelte';
	import EntryModal from '$lib/components/EntryModal.svelte';
	import MonthGrid from '$lib/components/MonthGrid.svelte';
	import QuickLinks from '$lib/components/QuickLinks.svelte';
	import TodoSidebar from '$lib/components/TodoSidebar.svelte';
	import { addMonths } from '$lib/dates';
	import type { ContentItem, Task } from '$lib/meta';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// View toggle, remembered across visits (UI-only preference → localStorage).
	let view = $state<'month' | 'agenda'>(
		(browser && (localStorage.getItem('sga-view') as 'month' | 'agenda')) || 'month'
	);
	$effect(() => {
		if (browser) localStorage.setItem('sga-view', view);
	});

	let modal = $state<null | {
		kind: 'task' | 'content';
		task?: Task;
		content?: ContentItem;
		date?: string;
	}>(null);

	let dayOpen = $state<string | null>(null);

	function edit(kind: 'task' | 'content', item: Task | ContentItem) {
		dayOpen = null;
		modal =
			kind === 'task' ? { kind, task: item as Task } : { kind, content: item as ContentItem };
	}

	const dayTasks = $derived(data.tasks.filter((t) => t.due_date === dayOpen));
	const dayContent = $derived(data.content.filter((c) => c.post_date === dayOpen));

	const monthLabel = $derived(
		new Date(data.month + '-01T00:00:00Z').toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		})
	);
</script>

<svelte:head><title>Calendar — SGA Comms</title></svelte:head>

<div class="flex flex-col gap-6 lg:flex-row">
	<div class="min-w-0 flex-1">
		<div class="mb-4 flex flex-wrap items-center gap-3">
			<h1 class="text-lg font-semibold">{monthLabel}</h1>

			<div class="flex items-center gap-1">
				<a
					href="?month={addMonths(data.month, -1)}"
					class="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm hover:bg-stone-100"
					aria-label="Previous month">←</a
				>
				<a
					href="?month={addMonths(data.month, 1)}"
					class="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm hover:bg-stone-100"
					aria-label="Next month">→</a
				>
				<a href="/" class="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm hover:bg-stone-100">
					Today
				</a>
			</div>

			<div class="ml-auto flex items-center gap-3">
				<div class="flex gap-1 rounded-lg bg-stone-200 p-1 text-sm">
					<button
						type="button"
						class="rounded-md px-3 py-1 {view === 'month' ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}"
						onclick={() => (view = 'month')}
					>
						Month
					</button>
					<button
						type="button"
						class="rounded-md px-3 py-1 {view === 'agenda' ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}"
						onclick={() => (view = 'agenda')}
					>
						Agenda
					</button>
				</div>
				<button
					type="button"
					onclick={() => (modal = { kind: 'content', date: data.today })}
					class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90"
				>
					+ New
				</button>
			</div>
		</div>

		{#if view === 'month'}
			<MonthGrid
				gridStart={data.gridStart}
				gridEnd={data.gridEnd}
				month={data.month}
				today={data.today}
				tasks={data.tasks}
				content={data.content}
				onedit={edit}
				onopenday={(date) => (dayOpen = date)}
			/>
		{:else}
			<Agenda
				today={data.today}
				tasks={data.tasks}
				content={data.content}
				undatedContent={data.undatedContent}
				onedit={edit}
			/>
		{/if}
	</div>

	<aside class="w-full shrink-0 space-y-4 self-start lg:sticky lg:top-4 lg:w-72">
		<TodoSidebar
			noDate={data.noDate}
			overdue={data.overdue}
			completed={data.completed}
			today={data.today}
			onedit={edit}
		/>
		<QuickLinks links={data.links} />
	</aside>
</div>

{#if dayOpen}
	<DayModal
		date={dayOpen}
		today={data.today}
		tasks={dayTasks}
		content={dayContent}
		onedit={edit}
		onadd={(kind) => {
			modal = { kind, date: dayOpen! };
			dayOpen = null;
		}}
		onclose={() => (dayOpen = null)}
	/>
{/if}

{#if modal}
	<EntryModal
		kind={modal.kind}
		task={modal.task}
		content={modal.content}
		date={modal.date ?? ''}
		projects={data.projects}
		tags={data.tags}
		onclose={() => (modal = null)}
	/>
{/if}
