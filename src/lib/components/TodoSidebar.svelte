<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fmtDate } from '$lib/dates';
	import type { Task } from '$lib/meta';
	import TaskCheck from './TaskCheck.svelte';

	let {
		noDate,
		overdue,
		completed,
		today,
		onedit
	}: {
		noDate: Task[];
		overdue: Task[];
		completed: Task[];
		today: string;
		onedit: (kind: 'task', item: Task) => void;
	} = $props();

	// Local copy of the pending list so rows can shuffle live while dragging;
	// resyncs whenever the server data changes.
	let items = $state<Task[]>([]);
	$effect(() => {
		items = [...noDate];
	});

	let dragId = $state<number | null>(null);

	function dragOver(e: DragEvent, overId: number) {
		e.preventDefault();
		if (dragId === null || dragId === overId) return;
		const from = items.findIndex((t) => t.id === dragId);
		const to = items.findIndex((t) => t.id === overId);
		if (from < 0 || to < 0) return;
		const [moved] = items.splice(from, 1);
		items.splice(to, 0, moved);
	}

	async function drop() {
		if (dragId === null) return;
		dragId = null;
		const fd = new FormData();
		fd.set('ids', items.map((t) => t.id).join(','));
		await fetch('/?/reorderTasks', {
			method: 'POST',
			body: fd,
			headers: { 'x-sveltekit-action': 'true' }
		});
		await invalidateAll();
	}
</script>

{#snippet deleteButton(task: Task)}
	<form
		method="POST"
		action="/?/deleteTask"
		use:enhance
		onsubmit={(e) => !confirm(`Delete "${task.title}"?`) && e.preventDefault()}
		class="inline-flex"
	>
		<input type="hidden" name="id" value={task.id} />
		<button
			type="submit"
			aria-label={`Delete "${task.title}"`}
			class="px-1 text-stone-300 hover:text-red-600"
		>
			✕
		</button>
	</form>
{/snippet}

<div class="flex max-h-[calc(100vh-7rem)] flex-col rounded-lg border border-stone-200 bg-white p-4">
	<h2 class="text-sm font-semibold text-stone-700">To-Do</h2>

	<form method="POST" action="/?/createTask" use:enhance class="mt-3">
		<input
			name="title"
			required
			placeholder="Quick add a task…"
			autocomplete="off"
			class="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none"
		/>
	</form>

	<div class="mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
		{#if overdue.length}
			<h3 class="mt-3 text-xs font-semibold tracking-wide text-maroon uppercase">Overdue</h3>
			<ul class="mt-1 space-y-1">
				{#each overdue as task (task.id)}
					<li class="flex items-center gap-2 text-sm">
						<TaskCheck {task} />
						<button
							type="button"
							onclick={() => onedit('task', task)}
							class="min-w-0 flex-1 truncate text-left text-maroon"
						>
							{task.title}
						</button>
						<span class="text-xs whitespace-nowrap text-maroon/70">{fmtDate(task.due_date!, today)}</span>
						{@render deleteButton(task)}
					</li>
				{/each}
			</ul>
		{/if}

		<h3 class="mt-3 text-xs font-semibold tracking-wide text-stone-400 uppercase">No date</h3>
		{#if items.length}
			<ul class="mt-1 space-y-1" ondrop={drop} role="list">
				{#each items as task (task.id)}
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<li
						draggable="true"
						ondragstart={() => (dragId = task.id)}
						ondragover={(e) => dragOver(e, task.id)}
						ondragend={drop}
						class="flex items-center gap-2 rounded text-sm {dragId === task.id ? 'opacity-40' : ''}"
					>
						<span class="cursor-grab text-stone-300 select-none" aria-hidden="true" title="Drag to reorder">⠿</span>
						<TaskCheck {task} />
						<button
							type="button"
							onclick={() => onedit('task', task)}
							class="min-w-0 flex-1 truncate text-left"
						>
							{task.title}
						</button>
						{@render deleteButton(task)}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-1 text-xs text-stone-400">Nothing here — nice.</p>
		{/if}

		{#if completed.length}
			<details class="mt-4">
				<summary class="cursor-pointer text-xs font-semibold tracking-wide text-stone-400 uppercase select-none">
					Completed ({completed.length})
				</summary>
				<ul class="mt-1 space-y-1">
					{#each completed as task (task.id)}
						<li class="flex items-center gap-2 text-sm">
							<TaskCheck {task} />
							<button
								type="button"
								onclick={() => onedit('task', task)}
								class="min-w-0 flex-1 truncate text-left text-stone-400 line-through"
							>
								{task.title}
							</button>
							{@render deleteButton(task)}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	</div>
</div>
