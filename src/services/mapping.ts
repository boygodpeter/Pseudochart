import type { AppState } from '../state';

// 解析 line mapping，並可選擇寫入 state.nodeIdToLine
export function parseLineMapping(mappingStr: string, state?: AppState): Map<number, string[]> {
	const map = new Map<number, string[]>();
	try {
		console.log('Raw line mapping string:', mappingStr);
		const mapping = JSON.parse(mappingStr);
		console.log('Parsed JSON mapping:', mapping);

		for (const [line, nodes] of Object.entries(mapping)) {
			const lineNum = parseInt(line);
			const arr = nodes as string[];
			map.set(lineNum, arr);
			console.log(`Line ${lineNum} maps to nodes:`, arr);

			for (const nodeId of arr) {
				if (state) {
					state.nodeIdToLine.set(nodeId, lineNum);
				}
			}
		}
	} catch (e) {
		console.error('Error parsing line mapping:', e);
	}
	console.log('Final line to node map:', Array.from(map.entries()));
	return map;
}

export async function parseNodeSequence(sequenceStr: string, _nodeMeta: string, _fullCode: string): Promise<string[]> {
	let sequence: string[] = [];
	try {
		sequence = JSON.parse(sequenceStr);
	} catch (e) {
		console.error('Error parsing node sequence:', e);
		return ['Error parsing node sequence'];
	}
	return sequence;
}

export type NodeMeta = Record<
	string,
	{
		label: string;
		escaped_label: string;
		line: number | null;
	}
>;

export function parseNodeMeta(metaStr: string): NodeMeta {
	try {
		return JSON.parse(metaStr) as NodeMeta;
	} catch (e) {
		console.error('Error parsing node meta:', e);
		return {};
	}
}
