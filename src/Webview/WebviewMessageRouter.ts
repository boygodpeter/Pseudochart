/**
 * Router：純粹接 message、找對應 function、呼叫。
 * 它不處理“該做什麼”，只處理“交給誰”。
 * 
 * 只負責「command → 對應 handler」的分派，沒有業務邏輯(怎麼實現的細節)。
 */

import * as vscode from 'vscode';
import type { AppState } from '../state';
import type { WebviewEventHandler } from './WebviewEventHandler';

type MessageHandler = (message: any, ctx: { editor?: vscode.TextEditor }) => void;

// Webview message router: map command → handler (centralized, testable)
export class WebviewMessageRouter {
	private readonly state: AppState;
	private readonly handler: WebviewEventHandler;
	private readonly updatePseudocode: (state: AppState) => void;
	private readonly handlePseudocodeLinesClick: (lines: number[], state: AppState, handler: WebviewEventHandler) => void;
	private readonly routes: Map<string, MessageHandler>;

	constructor(
		state: AppState,
		handler: WebviewEventHandler,
		deps: {
			updatePseudocode: (state: AppState) => void;
			handlePseudocodeLinesClick: (lines: number[], state: AppState, handler: WebviewEventHandler) => void;
		}
	) {
		this.state = state;
		this.handler = handler;
		this.updatePseudocode = deps.updatePseudocode;
		this.handlePseudocodeLinesClick = deps.handlePseudocodeLinesClick;
		this.routes = new Map();

		// register routes
		this.routes.set('webview.FlowchartNodeClicked', async (msg) => {
			await this.handler.handleFlowchartNodeClick(msg);
		});

		this.routes.set('webview.requestClearEditor', (_msg, ctx) => {
			if (ctx.editor) {
				this.handler.clearEditor(ctx.editor);
			} else {
				console.warn('No active editor to clear.');
			}
		});

		this.routes.set('webview.clearPseudocodeHistory', () => {
			// 只清歷史與旗標；映射是否有效由 dirty flag 判斷
			this.state.pseudocodeHistory = [];
			this.state.currentLineMapping = [];
			this.state.pseudocodeToLineMap.clear();
			this.state.fullPseudocodeGenerated = false;
			this.state.mappingDirty = false;
			this.updatePseudocode(this.state);
		});

		this.routes.set('webview.pseudocodeLineClicked', async (msg) => {
			await this.handler.handlePseudocodeLineClick(msg.pseudocodeLine);
		});

		this.routes.set('webview.pseudocodeLinesClicked', (msg) => {
			this.handlePseudocodeLinesClick(msg.pseudocodeLines, this.state, this.handler);
		});
	}

	handle(message: any, ctx: { editor?: vscode.TextEditor }) {
		if (!this.validatePayload(message)) {
			this.sendError('invalid_payload', `Invalid payload for command: ${message?.command}`);
			return;
		}
		const fn = this.routes.get(message.command);
		if (!fn) {
			console.warn('Unhandled webview message command:', message.command);
			this.sendError('unknown_command', `Unhandled command: ${message.command}`);
			return;
		}
		fn(message, ctx);
	}

	private validatePayload(message: any): boolean {
		if (!message || typeof message.command !== 'string') {
			return false;
		}
		switch (message.command) {
			case 'webview.FlowchartNodeClicked':
				return typeof message.nodeId === 'string' && message.nodeId.length > 0;
			case 'webview.requestClearEditor':
			case 'webview.clearPseudocodeHistory':
				return true;
			case 'webview.pseudocodeLineClicked':
				return typeof message.pseudocodeLine === 'number';
			case 'webview.pseudocodeLinesClicked':
				return Array.isArray(message.pseudocodeLines) && message.pseudocodeLines.every((n: any) => typeof n === 'number');
			default:
				return false;
		}
	}

	private sendError(reason: string, detail?: string) {
		console.warn('WebviewMessageRouter error:', reason, detail);
		if (this.state.panel) {
			this.state.panel.webview.postMessage({
				command: 'webview.error',
				reason,
				detail
			});
		}
	}
}
