import * as vscode from 'vscode';
import * as path from 'path';
import { codeToPseudocode, PseudocodeResult } from './claudeApi';
import * as dotenv from 'dotenv';
import { parsePythonWithAST } from './pythonAnalyzer';
import { WebviewEventHandler } from './Webview/WebviewEventHandler';
import { getWebviewHtmlExternal } from "./Webview/HtmlTemplateLoader";
import type { AppState } from './state';
import { createInitialAppState } from './state';
// import { escapeHtml } from './utils';

let nodeOrder: string[] = [];

const pseudocodeCache = new Map<string, string>();
// pseudocodeHistory moved into AppState; no module-level pseudocodeHistory

// mapping relation
// @Param:
//    lineToNodeMap       : map 'lineno-of-code : number' to 'nodeId: string'
//    currentLineMapping  : ?
//    pseudocodeToLineMap : map 'lineno-of-pseudocode : number' to 'lineno-of-code : number'
//    nodeIdToLine        : map 'nodeId-of-flowchart-element : string' to 'lineno-of-code : number'
// Migration complete: mappings and related state are stored in AppState (appState.*)

export function activate(context: vscode.ExtensionContext) {
    const extensionPath = context.extensionPath;
    dotenv.config({ path: path.join(extensionPath, '.env') });

    // create centralized state and handler (injected)
    const appState: AppState = createInitialAppState();
    const handler = new WebviewEventHandler(appState);

    console.log('Code2Pseudocode extension is now active!');
    console.log('Extension path:', extensionPath);
    console.log('CLAUDE_API_KEY exists:', !!process.env.CLAUDE_API_KEY);
    
    const disposable = vscode.commands.registerCommand('code2pseudocode.convertToPseudocode', async () => {
        await convertToPseudocode(appState, handler);
    });

    const onChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length > 0) {
            const hasRealChanges = event.contentChanges.some(change => {
                return change.text.trim() !== '' || change.rangeLength > 0;
            });

            if (hasRealChanges) {
                pseudocodeCache.clear();
                // keep appState in sync
                appState.currentLineMapping = [];
                appState.fullPseudocodeGenerated = false;
            }
        }
    });
    
    let generateDisposable = vscode.commands.registerCommand('m5-test2.generate', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active Python file');
            return;
        }

        const document = editor.document;
        
        if (document.languageId !== 'python') {
            vscode.window.showErrorMessage('Current file is not a Python file');
            return;
        }

        const code = document.getText();
        appState.sourceDocUri = editor.document.uri;
        
        try {
            const { mermaidCode, lineMapping, nodeSequence, nodeMeta } = await parsePythonWithAST(code);
            
            console.log('Generated Mermaid code:');
            console.log(mermaidCode);
            console.log('Line mapping:', lineMapping);
            console.log('Node sequence:', nodeSequence);

            // use AppState as single source of truth for pseudocode history
            appState.pseudocodeHistory = [];
            
            let pseudocodeText = '等待生成 Pseudocode...';
            
            const parsedMap = parseLineMapping(lineMapping, appState);
            appState.lineToNodeMap = parsedMap;
            console.log('Parsed line to node map:', Array.from(parsedMap.entries()));
            
            nodeOrder = await parseNodeSequence(nodeSequence, nodeMeta, code);
            console.log('Node order:', nodeOrder);
            
            if (appState.panel) {
                appState.panel.reveal(vscode.ViewColumn.Two);
            } else {
                // create the panel and set AppState as the single source
                const panel = vscode.window.createWebviewPanel(
                    'pythonFlowchart',
                    'Python Flowchart',
                    vscode.ViewColumn.Two,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
                    }
                );

                panel.onDidDispose(() => {
                    // clear AppState; remove legacy shims entirely
                    appState.panel = undefined;
                    appState.pseudocodeHistory = [];
                    appState.currentLineMapping = [];
                    appState.pseudocodeToLineMap.clear();
                    appState.fullPseudocodeGenerated = false;
                });

                appState.panel = panel;
            }

            // use appState.panel for webview interactions
            appState.panel!.webview.html = await getWebviewHtmlExternal(
                appState.panel!.webview,
                context,
                mermaidCode,
                nodeOrder,
                getPseudocodeHistoryText(appState)
            );
            
            appState.panel!.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'webview.FlowchartNodeClicked':
                            handler.handleFlowchartNodeClick(message);
                            break;
                        case 'webview.requestClearEditor':
                            handler.clearEditor(editor);
                            break;
                        case 'webview.clearPseudocodeHistory':
                            // clear history via AppState only
                            appState.pseudocodeHistory = [];
                            appState.currentLineMapping = [];
                            appState.pseudocodeToLineMap.clear();
                            appState.fullPseudocodeGenerated = false;
                            updateWebviewPseudocode(appState);
                            break;
                        case 'webview.pseudocodeLineClicked':
                            handler.handlePseudocodeLineClick(message.pseudocodeLine);
                            break;
                        case 'webview.pseudocodeLinesClicked':
                            console.log('收到 webview.pseudocodeLinesClicked 消息:', message);
                            handlePseudocodeLinesClick(message.pseudocodeLines, appState, handler);
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error generating flowchart: ${error}`);
        }
    });

    const clearHistoryDisposable = vscode.commands.registerCommand('code2pseudocode.clearHistory', () => {
        // clear AppState history
        appState.pseudocodeHistory = [];
        appState.currentLineMapping = [];
        appState.pseudocodeToLineMap.clear();
        appState.fullPseudocodeGenerated = false;
        updateWebviewPseudocode(appState);
        vscode.window.showInformationMessage('Pseudocode history cleared');
    });
    
    let selectionDisposable = vscode.window.onDidChangeTextEditorSelection((e) => {
        if (!appState.panel) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'python') {
            return;
        }
        if (editor.document.uri !== appState.sourceDocUri) {
            console.error('current editor is not where the flowchart come from');
            return;
        }

        const selection = e.selections[0];
        handler.clearEditor(editor);
        
        if (!selection.isEmpty) {
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            
            console.log(`Selection from line ${startLine} to ${endLine}`);
            
            const allNodeIds = new Set<string>();
            const pythonLines: number[] = [];
            
            for (let line = startLine; line <= endLine; line++) {
                const nodeIds = appState.lineToNodeMap.get(line);
                if (nodeIds && nodeIds.length > 0) {
                    nodeIds.forEach(id => allNodeIds.add(id));
                }
                pythonLines.push(line);
            }
            
            if (allNodeIds.size > 0 || pythonLines.length > 0) {
                console.log('Highlighting nodes for Python lines:', Array.from(allNodeIds), pythonLines);
                
                handler.highlightNodesAndPseudocodeInWebview(Array.from(allNodeIds), pythonLines);
            } else {
                handler.clearHighlightInWebviewPanel();
            }
        } else {
            const lineNumber = selection.active.line + 1;
            
            console.log('Cursor at line:', lineNumber);
            
            const nodeIds = appState.lineToNodeMap.get(lineNumber);
            
            if (nodeIds && nodeIds.length > 0) {
                console.log('Found nodes for line', lineNumber, ':', nodeIds);
                
                handler.highlightNodesAndPseudocodeInWebview(nodeIds, [lineNumber]);
            } else {
                handler.clearHighlightInWebviewPanel();
            }
        }
    });

    context.subscriptions.push(generateDisposable);
    context.subscriptions.push(selectionDisposable);
    context.subscriptions.push(disposable, onChangeDisposable, clearHistoryDisposable);
 }

function handlePseudocodeLinesClick(pseudocodeLines: number[], state: AppState, handler: WebviewEventHandler) {
    console.log('=== handlePseudocodeLinesClick Debug ===');
    console.log('收到的 pseudocode 行號:', pseudocodeLines);
    
    // 檢查是否已生成完整的 pseudocode
    if (!state.fullPseudocodeGenerated || state.pseudocodeToLineMap.size === 0) {
        const message = '請先執行 "Convert to Pseudocode" 命令生成映射';
        vscode.window.showWarningMessage(message);
        console.warn('pseudocodeToLineMap 為空或未生成完整 pseudocode');
        console.warn('fullPseudocodeGenerated:', state.fullPseudocodeGenerated);
        console.warn('pseudocodeToLineMap.size:', state.pseudocodeToLineMap.size);
        return;
    }
    
    // 檢查 sourceDocUri 是否存在
    if (!state.sourceDocUri) {
        console.error('sourceDocUri 未設置');
        vscode.window.showErrorMessage('找不到源文件，請重新生成 flowchart');
        return;
    }
    
    console.log('當前 pseudocodeToLineMap 大小:', state.pseudocodeToLineMap.size);
    console.log('pseudocodeToLineMap 內容:', Array.from(state.pseudocodeToLineMap.entries()).slice(0, 10));
    
    // 將 pseudocode 行映射到 Python 行
    const pythonLines = new Set<number>();
    const allNodeIds = new Set<string>();
    
    pseudocodeLines.forEach(pseudoLine => {
        const pythonLine = state.pseudocodeToLineMap.get(pseudoLine);
        console.log(`映射: Pseudo 行 ${pseudoLine} -> Python 行 ${pythonLine}`);
        
        if (pythonLine !== undefined) {
            pythonLines.add(pythonLine);
            
            // 獲取對應的節點
            const nodeIds = state.lineToNodeMap.get(pythonLine);
            console.log(`  Python 行 ${pythonLine} 對應的節點:`, nodeIds);
            
            if (nodeIds && nodeIds.length > 0) {
                nodeIds.forEach(id => allNodeIds.add(id));
            }
        } else {
            console.warn(`  找不到 pseudocode 行 ${pseudoLine} 的映射`);
        }
    });
    
    if (pythonLines.size === 0) {
        console.error('找不到對應的 Python 代碼行');
        vscode.window.showWarningMessage('找不到對應的 Python 代碼行');
        return;
    }
    
    console.log('映射到的 Python 行:', Array.from(pythonLines));
    console.log('映射到的節點:', Array.from(allNodeIds));
    
    //找到最小和最大的 Python 行號
    const sortedLines = Array.from(pythonLines).sort((a, b) => a - b);
    const startLine = sortedLines[0] - 1; // VS Code 使用 0-based index
    const endLine = sortedLines[sortedLines.length - 1] - 1;
    
    console.log('選取範圍: 行', startLine, '到', endLine, '(0-based)');
    
    //使用 sourceDocUri 打開文檔並設置選取
    vscode.window.showTextDocument(state.sourceDocUri!, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false  // 將焦點移到編輯器
    }).then(editor => {
        try {
            //清除編輯器現有裝飾
            handler.clearEditor(editor);
            
            //在編輯器中選中對應的代碼行
            const newSelection = new vscode.Selection(
                new vscode.Position(startLine, 0),
                new vscode.Position(endLine, editor.document.lineAt(endLine).text.length)
            );
            
            editor.selection = newSelection;
            editor.revealRange(newSelection, vscode.TextEditorRevealType.InCenter);
            
            console.log('編輯器選取已設置');
            
            // 高亮對應的節點和 pseudocode 行
            if (state.panel) {
                handler.highlightNodesAndPseudocodeInWebview(Array.from(allNodeIds), Array.from(pythonLines));
            } else {
                console.error('沒有當前的面板');
            }
            
            console.log('=== handlePseudocodeLinesClick 完成 ===');
            
        } catch (error) {
            console.error('選擇代碼時出錯:', error);
            vscode.window.showErrorMessage('選擇代碼時出錯: ' + error);
        }
    }, error => {
        console.error('無法打開文檔:', error);
        vscode.window.showErrorMessage('無法打開源文件: ' + error);
    });
 }
function addToPseudocodeHistory(state: AppState, pseudocode: string) {
    const maxHistory = 50;
    state.pseudocodeHistory.push(pseudocode);
    if (state.pseudocodeHistory.length > maxHistory) {
        state.pseudocodeHistory = state.pseudocodeHistory.slice(-maxHistory);
    }
}

function getPseudocodeHistoryText(state: AppState): string {
    if (state.pseudocodeHistory.length === 0) {
        return '等待生成 Pseudocode...';
    }
    return state.pseudocodeHistory.join('\n');
}

function updateWebviewPseudocode(state: AppState) {
    if (state.panel) {
        state.panel.webview.postMessage({
            command: 'updatePseudocode',
            pseudocode: getPseudocodeHistoryText(state)
        });
        
        if (state.currentLineMapping.length > 0) {
            state.panel.webview.postMessage({
                command: 'setLineMapping',
                mapping: state.currentLineMapping
            });
        }
    }
}




function parseLineMapping(mappingStr: string, state?: AppState): Map<number, string[]> {
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
            
            // Register ALL node ids for this line (store in AppState)
            for (const nodeId of arr) {
                if (state) { state.nodeIdToLine.set(nodeId, lineNum); }
            }
        }
    } catch (e) {
        console.error('Error parsing line mapping:', e);
    }
    console.log('Final line to node map:', Array.from(map.entries()));
    return map;
}

async function parseNodeSequence(sequenceStr: string, nodeMeta: string, fullCode: string): Promise<string[]> {
    let sequence: string[] = [];
    try {
        sequence = JSON.parse(sequenceStr);
    } catch (e) {
        console.error('Error parsing node sequence:', e);
        return ['Error parsing node sequence'];
    }
    return sequence;
}

type NodeMeta = Record<string, { 
    label: string;
    escaped_label: string; 
    line: number | null 
}>;

function parseNodeMeta(metaStr: string): NodeMeta {
    try { return JSON.parse(metaStr) as NodeMeta; }
    catch (e) { console.error('Error parsing node meta:', e); return {}; }
}


async function convertToPseudocode(state: AppState, handler: WebviewEventHandler, isAutoUpdate: boolean = false) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        if (!isAutoUpdate) {
            vscode.window.showErrorMessage('請先打開一個程式碼文件');
        }
        return;
    }

    if (!state.panel) {
        vscode.window.showWarningMessage('請先執行 "Generate Flowchart" 命令');
        return;
    }

    if (state.fullPseudocodeGenerated) {
        vscode.window.showInformationMessage('Pseudocode 已生成，使用現有映射');
        return;
    }

    const document = editor.document;
    const fullCode = document.getText();

    if (!fullCode.trim()) {
        vscode.window.showErrorMessage('檔案內容為空');
        return;
    }

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
        if (!isAutoUpdate) {
            vscode.window.showErrorMessage('找不到 CLAUDE_API_KEY，請檢查 .env 檔案');
        }
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "正在轉換完整程式碼為 pseudocode...",
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 30, message: "正在呼叫 Claude API..." });
            
            const result: PseudocodeResult = await codeToPseudocode(fullCode);
            
            progress.report({ increment: 40, message: "正在處理結果..." });
            
            console.log('Received line mapping:', result.lineMapping);
            console.log('Pseudocode lines:', result.pseudocode.split('\n').length);
            
            // Put mapping into AppState (AppState is the single source of truth)
            state.currentLineMapping = result.lineMapping;
            state.pseudocodeToLineMap.clear();
            result.lineMapping.forEach(mapping => {
                state.pseudocodeToLineMap.set(mapping.pseudocodeLine, mapping.pythonLine);
            });
            console.log('Pseudocode to line map created:', Array.from(state.pseudocodeToLineMap.entries()));

            // Update pseudocode history and flags in AppState
            addToPseudocodeHistory(state, result.pseudocode);
            state.fullPseudocodeGenerated = true;

            updateWebviewPseudocode(state);
            
            progress.report({ increment: 30, message: "完成！" });
            console.log('Total mappings created:', state.currentLineMapping.length);
            vscode.window.showInformationMessage(
                `Pseudocode 生成完成！已映射 ${state.currentLineMapping.length} 行程式碼`
            );
 
        } catch (error) {
            console.error('轉換失敗:', error);
            if (!isAutoUpdate) {
                vscode.window.showErrorMessage(`轉換失敗: ${(error as Error).message}`);
            }
        }
    });
 }

export function deactivate() {
    // no-op: panels are tracked in AppState and will be cleaned up by the host
}