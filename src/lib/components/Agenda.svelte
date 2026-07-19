<script lang="ts">
	import { addDays, fmtDate, fmtTime } from '$lib/dates';
	import { PLATFORMS, contentColor, type ContentItem, type Task } from '$lib/meta';
	import StatusBadge from './StatusBadge.svelte';
	import TaskCheck from './TaskCheck.svelte';

	let {
		today,
		tasks,
		content,
		undatedContent,
		onedit
	}: {
		today: string;
		tasks: Task[];
		content: ContentItem[];
		undatedContent: ContentItem[];
		onedit: (kind: 'task' | 'content', item: Task | ContentItem) => void;
	} = $props();

	// One chronological group per date that has items.
	const groups = $derived.by(() => {
		const byDate = new Map<string, { tasks: Task[]; content: ContentItem[] }>();
		const bucket = (d: string) => {
			if (!byDate.has(d)) byDate.set(d, { tasks: [], content: [] });
			return byDate.get(d)!;
		};
		for (const t of tasks) if (t.due_date) bucket(t.due_date).tasks.push(t);
		for (const c of content) if (c.post_date) bucket(c.post_date).content.push(c);
		return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	function heading(date: string): string {
		if (date === today) return 'Today';
		if (date === addDays(today, 1)) return 'Tomorrow';
		return fmtDate(date, today);
	}
</script>

<div class="space-y-6">
	{#each groups as [date, g] (date)}
		<section>
			<h3 class="mb-2 text-sm font-semibold {date === today ? 'text-maroon' : 'text-stone-700'}">
				{heading(date)}
				{#if date === today || date === addDays(today, 1)}
					<span class="ml-1 font-normal text-stone-400">{fmtDate(date, today)}</span>
				{/if}
			</h3>
			<ul class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
				{#each g.content as item (item.id)}
					<li>
						<button
							type="button"
							onclick={() => onedit('content', item)}
							class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
						>
							<span class="size-2.5 shrink-0 rounded-full" style="background: {contentColor(item)}"></span>
							<span aria-hidden="true">{PLATFORMS[item.platform].icon}</span>
							<span class="min-w-0 flex-1 truncate">
								{item.title}
								{#if item.project_name}
									<span class="text-stone-400">· {item.project_name}</span>
								{/if}
							</span>
							{#if item.post_time}
								<span class="text-xs text-stone-500">{fmtTime(item.post_time)}</span>
							{/if}
							<StatusBadge status={item.status} />
						</button>
					</li>
				{/each}
				{#each g.tasks as task (task.id)}
					<li class="flex items-center gap-3 px-3 py-2 text-sm hover:bg-stone-50">
						<TaskCheck {task} />
						<button
							type="button"
							onclick={() => onedit('task', task)}
							class="min-w-0 flex-1 truncate text-left {task.done ? 'text-stone-400 line-through' : ''}"
						>
							{#if task.is_recurring}<span aria-hidden="true" class="text-stone-400">↻</span>{/if}
							{task.title}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="text-sm text-stone-500">Nothing scheduled this month.</p>
	{/each}

	{#if undatedContent.length}
		<section>
			<h3 class="mb-2 text-sm font-semibold text-stone-700">Someday / Unscheduled</h3>
			<ul class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
				{#each undatedContent as item (item.id)}
					<li>
						<button
							type="button"
							onclick={() => onedit('content', item)}
							class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
						>
							<span class="size-2.5 shrink-0 rounded-full" style="background: {contentColor(item)}"></span>
							<span aria-hidden="true">{PLATFORMS[item.platform].icon}</span>
							<span class="min-w-0 flex-1 truncate">
								{item.title}
								{#if item.project_name}
									<span class="text-stone-400">· {item.project_name}</span>
								{/if}
							</span>
							<StatusBadge status={item.status} />
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
