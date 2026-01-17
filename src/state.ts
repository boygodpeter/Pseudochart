import * as vscode from 'vscode';

export interface AppState {
	sourceDocUri?: vscode.Uri;
	panel?: vscode.WebviewPanel;

	// mapping relation
	// @Param:
	//    lineToNodeMap       : map 'lineno-of-code : number' to 'nodeId: string'
	//    currentLineMapping  : ?
	//    pseudocodeToLineMap : map 'lineno-of-pseudocode : number' to 'lineno-of-code : number'
	//    nodeIdToLine        : map 'nodeId-of-flowchart-element : string' to 'lineno-of-code : number'
	lineToNodeMap: Map<number, string[]>;
	currentLineMapping: Array<{ pythonLine: number; pseudocodeLine: number }>;
	pseudocodeToLineMap: Map<number, number>;
	nodeIdToLine: Map<string, number | null>;
	lastNormalizedHash?: string;
	lastLineCount?: number;
	mappingDirty: boolean;
	nodeOrder: string[];
	pseudocodeCache: Map<string, string>;

	// pseudocode history / generation state
	pseudocodeHistory: string[];
	fullPseudocodeGenerated: boolean;
}

// create a ready-to-use AppState
export function createInitialAppState(): AppState {
	return {
		sourceDocUri: undefined,
		panel: undefined,
		lineToNodeMap: new Map<number, string[]>(),
		currentLineMapping: [],
		pseudocodeToLineMap: new Map<number, number>(),
		nodeIdToLine: new Map<string, number | null>(),
		lastNormalizedHash: undefined,
		lastLineCount: undefined,
		mappingDirty: false,
		nodeOrder: [],
		pseudocodeCache: new Map<string, string>(),
		pseudocodeHistory: [],
		fullPseudocodeGenerated: false,
	};
}

// reset generated data (mappings/history) and optionally panel/doc references
export function resetAppState(state: AppState, options: { keepPanel?: boolean } = {}): AppState {
	state.lineToNodeMap = new Map<number, string[]>();
	state.currentLineMapping = [];
	state.pseudocodeToLineMap = new Map<number, number>();
	state.nodeIdToLine = new Map<string, number | null>();
	state.pseudocodeHistory = [];
	state.fullPseudocodeGenerated = false;
	state.lastNormalizedHash = undefined;
	state.lastLineCount = undefined;
	state.mappingDirty = false;
	state.nodeOrder = [];
	state.pseudocodeCache = new Map<string, string>();

	if (!options.keepPanel) {
		state.panel = undefined;
	}
	state.sourceDocUri = options.keepPanel ? state.sourceDocUri : undefined;
	return state;
}

// 標記映射已失效（但不清除資料，讓使用者可選擇是否重建）
export function markMappingDirty(state: AppState): AppState {
	state.mappingDirty = true;
	return state;
}
