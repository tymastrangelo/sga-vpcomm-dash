export const PLATFORMS = {
	instagram: { label: 'Instagram', icon: '📷', color: '#c13584' },
	tiktok: { label: 'TikTok', icon: '🎵', color: '#1f2937' },
	youtube: { label: 'YouTube', icon: '▶', color: '#dc2626' },
	website: { label: 'Website', icon: '🌐', color: '#2563eb' },
	moseley_tv: { label: 'Moseley TVs', icon: '📺', color: '#7c3aed' },
	email: { label: 'Email', icon: '✉', color: '#0891b2' },
	other: { label: 'Other', icon: '📌', color: '#6b7280' }
} as const;

export const STATUSES = {
	idea: { label: 'Idea', badge: 'bg-stone-200 text-stone-700' },
	in_progress: { label: 'In progress', badge: 'bg-amber-100 text-amber-800' },
	scheduled: { label: 'Scheduled', badge: 'bg-blue-100 text-blue-800' },
	posted: { label: 'Posted', badge: 'bg-green-100 text-green-800' }
} as const;

export type Platform = keyof typeof PLATFORMS;
export type Status = keyof typeof STATUSES;

export const PLATFORM_KEYS = Object.keys(PLATFORMS) as Platform[];
export const STATUS_KEYS = Object.keys(STATUSES) as Status[];

export interface Task {
	id: number;
	title: string;
	notes: string | null;
	due_date: string | null;
	done: number;
	done_at: string | null;
	is_recurring: number;
	recur_interval: 'weekly' | 'monthly' | null;
	recur_anchor: string | null;
	color: string | null;
	sort_order: number;
	created_at: string;
}

export interface Project {
	id: number;
	name: string;
	description: string | null;
	color: string | null;
	created_at: string;
}

export interface ContentItem {
	id: number;
	project_id: number | null;
	title: string;
	notes: string | null;
	post_date: string | null;
	post_time: string | null;
	platform: Platform;
	status: Status;
	created_at: string;
	project_name?: string | null;
	project_color?: string | null;
}

export interface FundedEvent {
	id: number;
	organization: string;
	description: string;
	event_date: string;
	approved: number;
	created_at: string;
}

export interface Link {
	id: number;
	title: string;
	url: string;
	created_at: string;
}

export interface Tag {
	id: number;
	key: string;
	label: string;
	color: string;
}

export function contentColor(item: ContentItem): string {
	return item.project_color || PLATFORMS[item.platform]?.color || PLATFORMS.other.color;
}
