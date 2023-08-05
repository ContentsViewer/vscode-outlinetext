// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as strings from './strings';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	vscode.languages.registerDocumentFormattingEditProvider("outlinetext", {
		provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {

			const r: vscode.TextEdit[] = [];
			let rLen = 0;

			for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
				const lineContent = document.lineAt(lineNumber).text;
				const maxLineColumn = lineContent.length;

				if (lineContent.length === 0) {
					continue;
				}

				const lastNonWhitespaceIndex = strings.lastNonWhitespaceIndex(lineContent);

				let fromColumn = 0;
				if (lastNonWhitespaceIndex === -1) {
					// Entire line is whitespace
					fromColumn = 0;
				} else if (lastNonWhitespaceIndex !== lineContent.length - 1) {
					// There is trailing whitespace
					fromColumn = lastNonWhitespaceIndex + 1;
				} else {
					// There is no trailing whitespace
					continue;
				}

				r[rLen++] = vscode.TextEdit.delete(new vscode.Range(
					lineNumber, fromColumn,
					lineNumber, maxLineColumn
				));
			}

			return r;
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }