export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

// new helper: check special start/end node ids
export function nodeIdStringIsStartOrEnd(nodeId: string): boolean {
	return nodeId === 'Start' || nodeId === 'End';
}