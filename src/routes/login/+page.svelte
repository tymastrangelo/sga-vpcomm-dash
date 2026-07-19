<script lang="ts">
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Log in — SGA Comms</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-stone-50 px-4">
	<form method="POST" class="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
		<h1 class="text-xl font-semibold text-maroon">SGA Comms Calendar</h1>
		<p class="mt-1 text-sm text-stone-500">Sign in to continue.</p>

		{#if form?.error}
			<p class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
		{/if}

		<label class="mt-6 block text-sm font-medium text-stone-700" for="email">Email</label>
		<input
			id="email" name="email" type="email" required autocomplete="username"
			class="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none"
		/>

		<label class="mt-4 block text-sm font-medium text-stone-700" for="password">Password</label>
		<input
			id="password" name="password" type="password" required autocomplete="current-password"
			class="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-maroon focus:ring-1 focus:ring-maroon focus:outline-none"
		/>

		<button
			type="submit"
			class="mt-6 w-full rounded-md bg-maroon px-4 py-2 text-sm font-medium text-white hover:bg-maroon/90"
		>
			Log in
		</button>
	</form>
</div>
