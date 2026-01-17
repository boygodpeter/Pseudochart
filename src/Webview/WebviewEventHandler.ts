import * as vscode from 'vscode';
import type { AppState } from '../state';
import { nodeIdStringIsStartOrEnd} from '../utils';

// decoration type (top-level, cache it)
const highlightDecorationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: new vscode.ThemeColor('editor.selectionBackground') // or a fixed rgba like 'rgba(255,235,59,0.25)'
});

export class WebviewEventHandler {
	private state: AppState;

	constructor(state: AppState) {
		this.state = state;
	}

	// event trigger when:
	// 		some node is clicked in webview(flowchart area)
	// event do:
	// 		1. highlight correspond line in TextEditor of orignal code
	// 		2. highlight correspond line in pseudo code
	public async handleFlowchartNodeClick(message: any): Promise<void> {
		if (this.state.mappingDirty) {
			const warn = '檔案空白/換行已變動，行號映射已失效；復原增加的換行，或重新生成流程圖/偽代碼。';
			console.warn(warn);
			vscode.window.showWarningMessage(warn);
			return;
		}

		const editor = await this.getSourceEditor();
		console.log('receive message: nodeClicked %s', message.nodeId);

		// check editor work
		if (!editor) {
			console.error('could not find vscode.window.activeTextEditor');
			return;
		}

		// special case
		// check not special case;
		// o.w. exit and clear highlight
		if (nodeIdStringIsStartOrEnd(message.nodeId)) {
			console.log('%s has no related line num', message.nodeId);
			this.clearEditor(editor);
			this.clearHighlightInWebviewPanel();
			return;
		}

		// normal case
		// check the target line exist;
		// o.w. exit and clear highlight
		const line = this.state.nodeIdToLine.get(message.nodeId) ?? null;
		if (!line) {
			console.error('can not find related line in mapping: %s', message.nodeId);
			this.clearEditor(editor);
			this.clearHighlightInWebviewPanel();
			return;
		}

		console.log(`Node ${message.nodeId} corresponds to line ${line}`);

		// this event do for TextEditor Area
		// 高亮 Python 編輯器中的對應行
		const lines: number[] = [line];
		const ranges = lines.map(ln => new vscode.Range(ln - 1, 0, ln - 1, Number.MAX_SAFE_INTEGER));

		this.highlightEditor(editor, ranges);

		// this event do for Pseudocode Area
		// 發送消息到 webview 高亮對應的 pseudocode 行
		this.highlightNodesAndPseudocodeInWebview([message.nodeId], lines);
	}

	// event trigger when:
	// 		some line of Pseudocode Area was clicked
	// event do: 
	// 		1. highlight correspond line in TextEditor of orignal code
	// 		2. highlight correspond line in pseudo code
	// 		3. highlight correspond node in flowchart
	public async handlePseudocodeLineClick(pseudocodeLine: number): Promise<void> {
		if (this.state.mappingDirty) {
			const warn = '檔案空白/換行已變動，行號映射已失效；復原增加的換行，或重新生成流程圖/偽代碼。';
			console.warn(warn);
			vscode.window.showWarningMessage(warn);
			return;
		}

		const editor = await this.getSourceEditor();

		console.log('Pseudocode line clicked:', pseudocodeLine);

		if (!editor) {
			console.error('could not find source editor');
			return;
		}

		// this event do for TextEditor Area
		// 從映射中找到對應的 Python 行
		const pythonLine = this.state.pseudocodeToLineMap?.get(pseudocodeLine);

		if (!pythonLine) {
			console.log('No Python line mapping found for pseudocode line:', pseudocodeLine);
			this.clearEditor(editor);
			this.clearHighlightInWebviewPanel();
			return;
		}

		console.log('Mapped to Python line:', pythonLine);

		// 高亮 Python 編輯器中的對應行
		const lineIndex = pythonLine - 1;
		const range = new vscode.Range(lineIndex, 0, lineIndex, Number.MAX_SAFE_INTEGER);

		this.highlightEditor(editor, [range]);

		// this event do for flowchart Area and Pseudocode Area
		// 找到對應的 nodes
		const nodeIds = this.state.lineToNodeMap?.get(pythonLine);
		console.log('Mapped to nodes:', nodeIds);

		// 發送消息到 webview 高亮對應的 flowchart 節點和 pseudocode
		this.highlightNodesAndPseudocodeInWebview(nodeIds || [], [pythonLine]);
	}

	// 取得 flowchart 對應的 editor
	private async getSourceEditor(): Promise<vscode.TextEditor | undefined> {
		if (!this.state.sourceDocUri) {
			console.error('找不到 flowchart 對應的 editor, 請打開正確頁面');
			vscode.window.showWarningMessage('找不到 flowchart 對應的 editor, 請打開正確頁面');
			return;
		}

		// 先找可見的 visible editor
		const vis = vscode.window.visibleTextEditors.find(
			(e) => e.document.uri.toString() === this.state.sourceDocUri!.toString()
		);
		if (vis) {
			return vis;
		}

		// 不可見就打開它 -- intentionally omitted to avoid race conditions
		// 若焦點不在來源檔，提示並略過高亮，避免閃爍/誤高亮
		const warn = '目前文字編輯器所在畫面(VScode 左半邊)，不是產生流程圖的來源檔；已取消 highlight，請切回原檔後再試。';
		console.warn(warn);
		vscode.window.showWarningMessage(warn);
		return;
	}

	//////////////////////////////////////////////////
	// 					Helper						//
	//////////////////////////////////////////////////

	private highlightEditor(
		editor: typeof vscode.window.activeTextEditor,
		ranges: readonly vscode.Range[]
	): void {
		if (!editor) {
			console.error('vscode.window.activeTextEditor was undefined when highlight editor');
			return;
		}

		if (!ranges) { 
			console.error('\'range\' was undefined when highlight editor');
			return;
		}

		console.log('ranges: ', ranges);
		editor.setDecorations(highlightDecorationType, ranges);

		// scroll to the first line
		if (ranges.length > 0) {
			editor.revealRange(ranges[0], vscode.TextEditorRevealType.InCenterIfOutsideViewport);
		}
	}

	public clearEditor(editor: typeof vscode.window.activeTextEditor): void {
		this.highlightEditor(editor, []);
	}

	public clearHighlightInWebviewPanel(): void {
		if (this.state.panel) {
			this.state.panel.webview.postMessage({
				command: 'clearHighlight'
			});
		}
	}

	public highlightNodesAndPseudocodeInWebview(paramNodeIds: string[], lines: number[]): void {
		if (this.state.panel) {
			this.state.panel.webview.postMessage({
				command: 'highlightNodesAndPseudocode',
				nodeIds: paramNodeIds,
				pseudocodeLines: lines
			});
		}
	}
}
