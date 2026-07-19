<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Task } from '$lib/meta';

	let { task }: { task: Task } = $props();
</script>

<form method="POST" action="/?/toggleTask" use:enhance class="inline-flex">
	<input type="hidden" name="id" value={task.id} />
	<button
		type="submit"
		aria-label={task.done ? 'Mark not done' : 'Mark done'}
		class="grid size-4 shrink-0 place-items-center rounded border text-[10px] leading-none
			{task.done ? 'border-green-600 bg-green-600 text-white' : 'border-stone-400 bg-white text-transparent hover:border-maroon'}"
	>
		✓
	</button>
</form>
