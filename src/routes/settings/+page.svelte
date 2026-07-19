<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Settings — SGA Comms</title></svelte:head>

<h1 class="text-lg font-semibold">Settings</h1>

<section class="mt-4 max-w-lg rounded-lg border border-stone-200 bg-white p-5">
	<h2 class="text-sm font-semibold text-stone-700">Tags & colors</h2>
	<p class="mt-1 text-xs text-stone-400">Used to color tasks on the calendar.</p>

	<ul class="mt-3 space-y-2">
		{#each data.tags as tag (tag.id)}
			<li class="flex items-center gap-2 text-sm">
				<span class="size-3 rounded-full" style="background: {tag.color}"></span>
				{tag.label}
				<span class="text-xs text-stone-400">({tag.key})</span>
			</li>
		{/each}
	</ul>

	{#if form?.error}
		<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
	{/if}

	<form method="POST" action="?/createTag" use:enhance class="mt-4 flex items-end gap-2">
		<div class="flex-1">
			<label class="block text-sm font-medium text-stone-700" for="tag-label">New tag</label>
			<input
				id="tag-label" name="label" required placeholder="e.g. Elections"
				class="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-maroon focus:outline-none"
			/>
		</div>
		<input name="color" type="color" value="#475569" aria-label="Tag color" class="h-8 w-12 cursor-pointer rounded border border-stone-300" />
		<button type="submit" class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90">
			Add
		</button>
	</form>
</section>

<section class="mt-6 max-w-lg rounded-lg border border-stone-200 bg-white p-5">
	<h2 class="text-sm font-semibold text-stone-700">Daily notifications (ntfy)</h2>
	<p class="mt-1 text-xs text-stone-400">
		Every morning at 8 AM ET you get a push with what to post, what's due, and what's overdue.
	</p>

	{#if data.ntfyTopic}
		<ol class="mt-3 list-decimal space-y-1 pl-5 text-sm text-stone-600">
			<li>Install the <span class="font-medium">ntfy</span> app (iOS/Android).</li>
			<li>
				Subscribe to this topic (or just open the link):
				<a
					href="https://ntfy.sh/{data.ntfyTopic}"
					target="_blank"
					rel="noopener noreferrer"
					class="font-mono text-maroon hover:underline"
				>
					ntfy.sh/{data.ntfyTopic}
				</a>
			</li>
			<li>Hit the test button below — a notification should arrive within seconds.</li>
		</ol>
		<p class="mt-2 text-xs text-stone-400">
			Keep the topic name private — anyone who knows it can read your digests.
		</p>

		{#if form?.notifyError}
			<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.notifyError}</p>
		{:else if form?.sent}
			<p class="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
				Sent! Check your phone.
			</p>
		{/if}

		<form method="POST" action="?/sendTestNotification" use:enhance class="mt-3">
			<button type="submit" class="rounded-md bg-maroon px-3 py-1.5 text-sm font-medium text-white hover:bg-maroon/90">
				Send test notification
			</button>
		</form>
	{:else}
		<p class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
			Set the <code>NTFY_TOPIC</code> environment variable to enable notifications.
		</p>
	{/if}
</section>

<section class="mt-6 max-w-lg rounded-lg border border-stone-200 bg-white p-5">
	<h2 class="text-sm font-semibold text-stone-700">Session</h2>
	<form method="POST" action="/logout" class="mt-3">
		<button type="submit" class="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100">
			Log out
		</button>
	</form>
</section>
