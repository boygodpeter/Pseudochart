import * as vscode from 'vscode';
import { escapeHtml } from '../utils';

/**
 - What: a tiny helper that generates a random string (the “nonce”).
 - Why: Webview uses a Content Security Policy (CSP) that blocks inline scripts unless they carry a matching nonce.
 - Note: ONLY scripts who will be EXEcuted need to carry nonce
 */
function getNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let i = 0; i < 32; i++) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
}

// static resource is store in "/media"
// load template and replace placeholder
export async function getWebviewHtmlExternal(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    mermaidCode: string,
    nodeOrder: string[],
    pseudocode: string = ''
): Promise<string> {
    // 1. get the Html templates
    const templateUri = vscode.Uri.joinPath(context.extensionUri, 'media', 'flowchart_panel_template.html');
    const bytes = await vscode.workspace.fs.readFile(templateUri);
    let html = new TextDecoder('utf-8').decode(bytes);

    // 2. get correct path
    // JavaScripts Mermaid module
    const mermaidUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'media', 'mermaid.min.js')
    );
    // the css file
    const cssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, "media", "flowchart_panel.css")
    );
    // the JS file
    const jsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, "media", "flowchart_panel.js")
    );

    // 3. generate nonce
    const nonce = getNonce();

    // 4. replace placeholder
    html = html
        .replace(/%%CSP_SOURCE%%/g, webview.cspSource)
        .replace(/%%NONCE%%/g, nonce)
        .replace(/%%MERMAID_JS_URI%%/g, mermaidUri.toString())
        .replace(/%%MERMAID_CODE%%/g, mermaidCode)
        .replace(/%%NODE_ORDER_JSON%%/g, JSON.stringify(nodeOrder))
        .replace(/%%PSEUDOCODE%%/g, escapeHtml(pseudocode))
        .replace(/%%FLOWCHART_PANEL_CSS_URI%%/g, cssUri.toString())
        .replace(/%%FLOWCHART_PANEL_JS_URI%%/g, jsUri.toString())
        ; 

    return html;
}