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
		pseudocodeHistory: [],
		fullPseudocodeGenerated: false,
	};
}