<script lang="ts">
	import { fmtDate, fmtTime } from '$lib/dates';
	import { PLATFORMS, contentColor, type ContentItem, type Task } from '$lib/meta';
	import StatusBadge from './StatusBadge.svelte';
	import TaskCheck from './TaskCheck.svelte';

	let {
		date,
		today,
		tasks,
		content,
		onedit,
		onadd,
		onclose
	}: {
		date: string;
		today: string;
		tasks: Task[];
		content: ContentItem[];
		onedit: (kind: 'task' | 'content', item: Task | ContentItem) => void;
		onadd: (kind: 'task' | 'content') => void;
		onclose: () => void;
	} = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:items-center">
	<button type="button" class="fixed inset-0 cursor-default" aria-label="Close" onclick={onclose}></button>

	<div class="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
		<div class="flex items-center justify-between">
			<h2 class="text-base font-semibold">
				{fmtDate(date, today)}
				{#if date === today}<span class="ml-1 text-sm font-normal text-maroon">Today</span>{/if}
			</h2>
			<button type="button" class="text-stone-400 hover:text-stone-600" onclick={onclose} aria-label="Close">✕</button>
		</div>

		<div class="mt-4 space-y-1">
			{#each content as item (item.id)}
				<button
					type="button"
					onclick={() => onedit('content', item)}
					class="flex w-full items-center gap-2 rounded-md border-l-2 bg-stone-50 px-2 py-1.5 text-left text-sm hover:bg-stone-100"
					style="border-left-color: {contentColor(item)}"
				>
					<span aria-hidden="true">{PLATFORMS[item.platform].icon}</span>
					<span class="min-w-0 flex-1 truncate">
						{item.title}
						{#if item.project_name}<span class="text-stone-400">· {item.project_name}</span>{/if}
					</span>
					{#if item.post_time}<span class="text-xs text-stone-500">{fmtTime(item.post_time)}</span>{/if}
					<StatusBadge status={item.status} />
				</button>
			{/each}

			{#each tasks as task (task.id)}
				<div class="flex items-center gap-2 rounded-md border-l-2 bg-stone-50 px-2 py-1.5 text-sm" style="border-left-color: {task.color ?? '#94a3b8'}">
					<TaskCheck {task} />
					<button
						type="button"
						onclick={() => onedit('task', task)}
						class="min-w-0 flex-1 truncate text-left {task.done ? 'text-stone-400 line-through' : ''}"
					>
						{#if task.is_recurring}<span aria-hidden="true" class="text-stone-400">↻</span>{/if}
						{task.title}
					</button>
				</div>
			{/each}

			{#if !content.length && !tasks.length}
				<p class="py-2 text-sm text-stone-400">Nothing on this day yet.</p>
			{/if}
		</div>

		<div class="mt-5 flex gap-2">
			<button
				type="button"
				onclick={() => onadd('task')}
				class="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
			>
				+ Task
			</button>
			<button
				type="button"
				onclick={() => onadd('content')}
				class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90"
			>
				+ Content
			</button>
		</div>
	</div>
</div>
