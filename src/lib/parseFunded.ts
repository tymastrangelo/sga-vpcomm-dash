const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export interface ParsedFundedEvent {
	organization: string;
	description: string;
	event_date: string; // YYYY-MM-DD
}

/**
 * Parse the weekly funded-events email table pasted as text. Handles both
 * tab-separated rows (Outlook table copy) and one-cell-per-line pastes:
 * cells are flattened, header cells dropped, and each record is closed by
 * its date cell. Trailing non-date text (email signatures) is discarded.
 */
export function parseFundedEvents(text: string): ParsedFundedEvent[] {
	const cells = text
		.split('\n')
		.flatMap((line) => line.split('\t'))
		.map((c) => c.trim())
		.filter((c) => c && c !== '—' && !/^(organization|event description|event date)$/i.test(c));

	const out: ParsedFundedEvent[] = [];
	let buf: string[] = [];
	for (const cell of cells) {
		const m = US_DATE.exec(cell);
		if (m) {
			if (buf.length) {
				out.push({
					organization: buf[0],
					description: buf.slice(1).join(' ') || buf[0],
					event_date: `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
				});
			}
			buf = [];
		} else {
			buf.push(cell);
		}
	}
	return out;
}
