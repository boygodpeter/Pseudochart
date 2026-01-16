import * as vscode from 'vscode';

export enum CodeBlockType {
    FUNCTION = 'function',
    IF = 'if',
    FOR = 'for',
    WHILE = 'while',
    TRY = 'try',
    CLASS = 'class',
    SINGLE_LINE = 'single_line'
}


export interface CodeBlock {
    type: CodeBlockType;
    startLine: number;
    endLine: number;
    code: string;
    indentLevel: number;
}


//解析 Python 程式碼區塊
 
export class PythonCodeBlockParser {

    
    //根據鼠標位置找到對應的程式碼區塊
     
    public static findCodeBlock(document: vscode.TextDocument, position: vscode.Position): CodeBlock {
        const currentLine = position.line;
        const lines = document.getText().split('\n');

        //從當前行開始向上搜尋，找到最近的區塊開始
        const blockStart = this.findBlockStart(lines, currentLine);

        if (blockStart === null) {
            //沒有找到區塊，返回單行
            return this.createSingleLineBlock(document, currentLine);
        }

        const blockType = this.identifyBlockType(lines[blockStart.line]);
        const blockEnd = this.findBlockEnd(lines, blockStart.line, blockStart.indent);

        //提取區塊程式碼
        const blockLines = lines.slice(blockStart.line, blockEnd + 1);
        const code = blockLines.join('\n');

        return {
            type: blockType,
            startLine: blockStart.line,
            endLine: blockEnd,
            code: code,
            indentLevel: blockStart.indent
        };
    }

    
    //從指定行向上搜尋，找到區塊開始位置
    
    private static findBlockStart(lines: string[], startLine: number): { line: number, indent: number } | null {
        const currentIndent = this.getIndentLevel(lines[startLine]);

        //向上搜尋 找到縮排層級較小且以冒號結尾的行
        for (let i = startLine; i >= 0; i--) {
            const line = lines[i].trim();
            const indent = this.getIndentLevel(lines[i]);

            //跳過空行和註解
            if (!line || line.startsWith('#')) {
                continue;
            }

            //找到可能的區塊開始
            if (line.endsWith(':') && indent <= currentIndent) {
                const blockType = this.identifyBlockType(line);
                if (blockType !== CodeBlockType.SINGLE_LINE) {
                    return { line: i, indent: indent };
                }
            }

            //如果遇到縮排層級更小的行且不是區塊開始，停止搜尋
            if (indent < currentIndent && !line.endsWith(':')) {
                break;
            }
        }

        return null;
    }

    
    //找到區塊結束位置
     
    private static findBlockEnd(lines: string[], startLine: number, baseIndent: number): number {
        let endLine = startLine;

        for (let i = startLine + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            const indent = this.getIndentLevel(lines[i]);

            //跳過空行和註解
            if (!line || line.startsWith('#')) {
                continue;
            }

            
            if (indent <= baseIndent) {
                const isElseBlock = line.startsWith('elif ') || line.startsWith('else:') ||
                    line.startsWith('except') || line.startsWith('finally:');

                if (isElseBlock && indent === baseIndent) {
                    //找到 else 相關語句，繼續包含在區塊中
                    endLine = i;
                    continue;
                } else {
                    break;
                }
            }

            endLine = i;
        }

        return endLine;
    }

    
    //識別程式碼區塊類型
     
    private static identifyBlockType(line: string): CodeBlockType {
        const trimmed = line.trim();

        if (trimmed.startsWith('def ')) {
            return CodeBlockType.FUNCTION;
        } else if (trimmed.startsWith('class ')) {
            return CodeBlockType.CLASS;
        } else if (trimmed.startsWith('if ') || trimmed.startsWith('elif ')) {
            return CodeBlockType.IF;
        } else if (trimmed.startsWith('for ')) {
            return CodeBlockType.FOR;
        } else if (trimmed.startsWith('while ')) {
            return CodeBlockType.WHILE;
        } else if (trimmed.startsWith('try:')) {
            return CodeBlockType.TRY;
        } else {
            return CodeBlockType.SINGLE_LINE;
        }
    }

    
    //取得行的縮排層級
    private static getIndentLevel(line: string): number {
        let indent = 0;
        for (const char of line) {
            if (char === ' ') {
                indent++;
            } else if (char === '\t') {
                indent += 4; //tab = 4個空格
            } else {
                break;
            }
        }
        return indent;
    }


    private static createSingleLineBlock(document: vscode.TextDocument, lineNumber: number): CodeBlock {
        const line = document.lineAt(lineNumber);
        return {
            type: CodeBlockType.SINGLE_LINE,
            startLine: lineNumber,
            endLine: lineNumber,
            code: line.text,
            indentLevel: this.getIndentLevel(line.text)
        };
    }
}