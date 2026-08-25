<script lang="ts">
	import { fmtDate, fmtTime } from '$lib/dates';
	import { PLATFORMS, contentColor, type ContentItem, type Task } from '$lib/meta';
	import TaskCheck from './TaskCheck.svelte';

	let {
		today,
		tasks,
		content,
		onedit
	}: {
		today: string;
		tasks: Task[];
		content: ContentItem[];
		onedit: (kind: 'task' | 'content', item: Task | ContentItem) => void;
	} = $props();

	const todayTasks = $derived(tasks.filter((t) => t.due_date === today));
	const todayContent = $derived(content.filter((c) => c.post_date === today));
	const left = $derived(todayTasks.filter((t) => !t.done).length);
</script>

<div class="min-w-0 rounded-lg border border-stone-200 bg-white p-4">
	<div class="flex items-baseline gap-2">
		<h2 class="text-sm font-semibold text-stone-700">Today</h2>
		<span class="text-xs text-stone-400">{fmtDate(today, today)}</span>
		<span class="ml-auto text-xs text-stone-400">
			{left ? `${left} left` : todayTasks.length ? 'all clear' : ''}
		</span>
	</div>

	<div class="mt-2 space-y-1">
		{#each todayContent as item (item.id)}
			<button
				type="button"
				onclick={() => onedit('content', item)}
				class="flex w-full items-center gap-2 rounded-md border-l-2 bg-stone-50 px-2 py-1.5 text-left text-sm hover:bg-stone-100"
				style="border-left-color: {contentColor(item)}"
			>
				<span aria-hidden="true">{PLATFORMS[item.platform].icon}</span>
				<span class="min-w-0 flex-1 truncate">{item.title}</span>
				{#if item.post_time}<span class="text-xs text-stone-500">{fmtTime(item.post_time)}</span>{/if}
			</button>
		{/each}

		{#each todayTasks as task (task.id)}
			<div
				class="flex items-center gap-2 rounded-md border-l-2 bg-stone-50 px-2 py-1.5 text-sm"
				style="border-left-color: {task.color ?? '#94a3b8'}"
			>
				<TaskCheck {task} />
				<button
					type="button"
					onclick={() => onedit('task', task)}
					class="min-w-0 flex-1 truncate text-left {task.done ? 'text-stone-400 line-through' : ''}"
				>
					{task.title}
					{#if task.location}<span class="text-stone-400">· {task.location}</span>{/if}
				</button>
				{#if task.due_time}<span class="text-xs whitespace-nowrap text-stone-500">{fmtTime(task.due_time)}</span>{/if}
			</div>
		{/each}

		{#if !todayTasks.length && !todayContent.length}
			<p class="py-1 text-sm text-stone-400">Nothing on the books today.</p>
		{/if}
	</div>
</div>
