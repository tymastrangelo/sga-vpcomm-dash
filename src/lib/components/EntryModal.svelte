<script lang="ts">
	import { enhance } from '$app/forms';
	import { PLATFORMS, STATUSES, PLATFORM_KEYS, STATUS_KEYS } from '$lib/meta';
	import type { ContentItem, Project, Tag, Task } from '$lib/meta';
	import ColorPicker from './ColorPicker.svelte';

	let {
		kind,
		task = null,
		content = null,
		date = '',
		projects,
		tags,
		lockKind = false,
		fixedProjectId = null,
		onclose
	}: {
		kind: 'task' | 'content';
		task?: Task | null;
		content?: ContentItem | null;
		date?: string;
		projects: Project[];
		tags: Tag[];
		lockKind?: boolean;
		fixedProjectId?: number | null;
		onclose: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally -- initial value only; the toggle owns it after mount
	let activeKind = $state(kind);
	let error = $state('');
	const editing = $derived(activeKind === 'task' ? task : content);

	const action = $derived(
		activeKind === 'task'
			? task
				? '/?/updateTask'
				: '/?/createTask'
			: content
				? '/?/updateContent'
				: '/?/createContent'
	);

	const submit = () => {
		error = '';
		return async ({ result, update }: any) => {
			if (result.type === 'failure') error = result.data?.error ?? 'Something went wrong.';
			await update();
			if (result.type === 'success') onclose();
		};
	};

	const inputCls =
		'mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none';
	const labelCls = 'mt-3 block text-sm font-medium text-stone-700';
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:overflow-y-auto sm:p-4">
	<button type="button" class="fixed inset-0 cursor-default" aria-label="Close" onclick={onclose}></button>

	<div
		class="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-none sm:rounded-xl sm:pb-6"
	>
		<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 sm:hidden" aria-hidden="true"></div>
		<div class="flex items-center justify-between">
			{#if !editing && !lockKind}
				<div class="flex gap-1 rounded-lg bg-stone-100 p-1 text-sm">
					<button
						type="button"
						class="rounded-md px-3 py-1 {activeKind === 'task' ? 'bg-white font-medium shadow-sm' : 'text-stone-500'}"
						onclick={() => (activeKind = 'task')}
					>
						Task
					</button>
					<button
						type="button"
						class="rounded-md px-3 py-1 {activeKind === 'content' ? 'bg-white font-medium shadow-sm' : 'text-stone-500'}"
						onclick={() => (activeKind = 'content')}
					>
						Content
					</button>
				</div>
			{:else}
				<h2 class="text-base font-semibold">
					{editing ? 'Edit' : 'New'}
					{activeKind === 'task' ? 'task' : 'content item'}
				</h2>
			{/if}
			<button type="button" class="text-stone-400 hover:text-stone-600" onclick={onclose} aria-label="Close">✕</button>
		</div>

		{#if error}
			<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
		{/if}

		{#if activeKind === 'task'}
			<form method="POST" {action} use:enhance={submit}>
				{#if task}<input type="hidden" name="id" value={task.id} />{/if}

				<label class={labelCls} for="t-title">Title</label>
				<input id="t-title" name="title" required class={inputCls} value={task?.title ?? ''} />

				<label class={labelCls} for="t-date">Due date <span class="font-normal text-stone-400">(blank = to-do list)</span></label>
				<input id="t-date" name="due_date" type="date" class={inputCls} value={task?.due_date ?? date} />

				<label class={labelCls} for="t-recur">Repeats</label>
				<select id="t-recur" name="recur_interval" class={inputCls} value={task?.recur_interval ?? ''}>
					<option value="">Never</option>
					<option value="weekly">Weekly</option>
					<option value="monthly">Monthly</option>
				</select>

				<span class={labelCls}>Color <span class="font-normal text-stone-400">(presets or pick your own)</span></span>
				<ColorPicker name="color" value={task?.color ?? ''} {tags} />

				<label class={labelCls} for="t-notes">Notes</label>
				<textarea id="t-notes" name="notes" rows="2" class={inputCls}>{task?.notes ?? ''}</textarea>

				<div class="mt-5 flex items-center justify-between">
					<button type="submit" class="rounded-md bg-maroon px-4 py-2 text-sm font-medium text-white hover:bg-maroon/90">
						{task ? 'Save' : 'Add task'}
					</button>
				</div>
			</form>
			{#if task}
				<form
					method="POST"
					action="/?/deleteTask"
					use:enhance={submit}
					onsubmit={(e) => !confirm('Delete this task?') && e.preventDefault()}
					class="-mt-9 flex justify-end"
				>
					<input type="hidden" name="id" value={task.id} />
					<button type="submit" class="px-2 py-2 text-sm text-red-600 hover:underline">Delete</button>
				</form>
			{/if}
		{:else}
			<form method="POST" {action} use:enhance={submit}>
				{#if content}<input type="hidden" name="id" value={content.id} />{/if}

				<label class={labelCls} for="c-title">Title</label>
				<input id="c-title" name="title" required class={inputCls} value={content?.title ?? ''} />

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class={labelCls} for="c-date">Post date</label>
						<input id="c-date" name="post_date" type="date" class={inputCls} value={content?.post_date ?? date} />
					</div>
					<div>
						<label class={labelCls} for="c-time">Time</label>
						<input id="c-time" name="post_time" type="time" class={inputCls} value={content?.post_time ?? ''} />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class={labelCls} for="c-platform">Platform</label>
						<select id="c-platform" name="platform" class={inputCls} value={content?.platform ?? 'instagram'}>
							{#each PLATFORM_KEYS as p (p)}
								<option value={p}>{PLATFORMS[p].label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class={labelCls} for="c-status">Status</label>
						<select id="c-status" name="status" class={inputCls} value={content?.status ?? 'idea'}>
							{#each STATUS_KEYS as s (s)}
								<option value={s}>{STATUSES[s].label}</option>
							{/each}
						</select>
					</div>
				</div>

				<label class={labelCls} for="c-project">Project</label>
				<select
					id="c-project"
					name="project_id"
					class={inputCls}
					value={String(content?.project_id ?? fixedProjectId ?? '')}
				>
					<option value="">Standalone</option>
					{#each projects as p (p.id)}
						<option value={String(p.id)}>{p.name}</option>
					{/each}
				</select>

				<label class={labelCls} for="c-notes">Notes</label>
				<textarea id="c-notes" name="notes" rows="2" class={inputCls}>{content?.notes ?? ''}</textarea>

				<div class="mt-5 flex items-center justify-between">
					<button type="submit" class="rounded-md bg-maroon px-4 py-2 text-sm font-medium text-white hover:bg-maroon/90">
						{content ? 'Save' : 'Add content'}
					</button>
				</div>
			</form>
			{#if content}
				<form
					method="POST"
					action="/?/deleteContent"
					use:enhance={submit}
					onsubmit={(e) => !confirm('Delete this content item?') && e.preventDefault()}
					class="-mt-9 flex justify-end"
				>
					<input type="hidden" name="id" value={content.id} />
					<button type="submit" class="px-2 py-2 text-sm text-red-600 hover:underline">Delete</button>
				</form>
			{/if}
		{/if}
	</div>
</div>
