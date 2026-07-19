<script lang="ts">
	import { STATUSES, type Status } from '$lib/meta';
	let { status }: { status: Status } = $props();
</script>

<span class="rounded-sm px-1 py-px text-[10px] font-medium whitespace-nowrap {STATUSES[status].badge}">
	{STATUSES[status].label}
</span>
