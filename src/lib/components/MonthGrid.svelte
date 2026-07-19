<script lang="ts">
	import { addDays } from '$lib/dates';
	import { PLATFORMS, contentColor, type ContentItem, type Task } from '$lib/meta';
	import StatusBadge from './StatusBadge.svelte';
	import TaskCheck from './TaskCheck.svelte';

	let {
		gridStart,
		gridEnd,
		month,
		today,
		tasks,
		content,
		onedit,
		onopenday
	}: {
		gridStart: string;
		gridEnd: string;
		month: string;
		today: string;
		tasks: Task[];
		content: ContentItem[];
		onedit: (kind: 'task' | 'content', item: Task | ContentItem) => void;
		onopenday: (date: string) => void;
	} = $props();

	const days = $derived.by(() => {
		const out: string[] = [];
		for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) out.push(d);
		return out;
	});

	const tasksByDay = $derived(Map.groupBy(tasks, (t) => t.due_date ?? ''));
	const contentByDay = $derived(Map.groupBy(content, (c) => c.post_date ?? ''));

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="overflow-x-auto">
	<div class="grid min-w-[640px] grid-cols-7 overflow-hidden rounded-lg border border-stone-200 bg-stone-200 gap-px">
		{#each WEEKDAYS as w (w)}
			<div class="bg-white px-2 py-1.5 text-xs font-medium text-stone-500">{w}</div>
		{/each}

		{#each days as day (day)}
			{@const inMonth = day.slice(0, 7) === month}
			{@const dayTasks = tasksByDay.get(day) ?? []}
			{@const dayContent = contentByDay.get(day) ?? []}
			<div
				class="min-h-24 cursor-pointer bg-white p-1 align-top hover:bg-stone-50 {inMonth ? '' : 'bg-stone-50 opacity-60'}"
				role="button"
				tabindex="0"
				aria-label="Open day {day}"
				onclick={() => onopenday(day)}
				onkeydown={(e) => e.key === 'Enter' && onopenday(day)}
			>
				<div class="mb-1 flex justify-end">
					<span
						class="grid size-5 place-items-center rounded-full text-xs {day === today
							? 'bg-maroon font-semibold text-white'
							: 'text-stone-500'}"
					>
						{Number(day.slice(8))}
					</span>
				</div>

				<div class="space-y-1">
					{#each dayContent as item (item.id)}
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								onedit('content', item);
							}}
							class="flex w-full items-center gap-1 rounded-sm border-l-2 bg-stone-50 px-1 py-0.5 text-left text-xs hover:bg-stone-100"
							style="border-left-color: {contentColor(item)}"
						>
							<span aria-hidden="true">{PLATFORMS[item.platform].icon}</span>
							<span class="min-w-0 flex-1 truncate">{item.title}</span>
							<StatusBadge status={item.status} />
						</button>
					{/each}

					{#each dayTasks as task (task.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							class="flex w-full items-center gap-1 rounded-sm border-l-2 px-1 py-0.5 text-xs hover:bg-stone-100
								{task.is_recurring ? 'border border-dashed border-stone-300' : 'bg-stone-50'}"
							style="border-left-color: {task.color ?? '#94a3b8'}"
							onclick={(e) => e.stopPropagation()}
						>
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
				</div>
			</div>
		{/each}
	</div>
</div>
