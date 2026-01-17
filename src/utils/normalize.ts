import crypto from 'crypto';

// Normalize text for stable hashing: trim邊界、統一換行、行內縮成單一空白、移除空行
export function normalizeText(text: string): string {
	const unified = text.trim().replace(/\r\n?/g, '\n');
	const lines: string[] = [];
	for (const line of unified.split('\n')) {
		const compact = line.trim().replace(/\s+/g, ' ');
		if (compact) {
			lines.push(compact);
		}
	}
	return lines.join('\n');
}

// 產生 SHA-256 雜湊（已正則化）
export function hashNormalizedText(text: string): string {
	const normalized = normalizeText(text);
	return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}
