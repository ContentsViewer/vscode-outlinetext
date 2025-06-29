import * as vscode from 'vscode';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('OutlineText extension is now active');

    // Register document formatting provider (original functionality)
    registerFormattingProvider(context);

    // Start language server
    startLanguageServer(context);

    // Register commands
    registerCommands(context);
}

function registerFormattingProvider(context: vscode.ExtensionContext) {
    const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
        'outlinetext',
        {
            provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
                const edits: vscode.TextEdit[] = [];

                for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
                    const line = document.lineAt(lineNumber);
                    const lineContent = line.text;

                    if (lineContent.length === 0) {
                        continue;
                    }

                    // Remove trailing whitespace
                    const trimmed = lineContent.trimEnd();
                    if (trimmed.length !== lineContent.length) {
                        edits.push(vscode.TextEdit.replace(
                            new vscode.Range(
                                lineNumber, trimmed.length,
                                lineNumber, lineContent.length
                            ),
                            ''
                        ));
                    }
                }

                return edits;
            }
        }
    );

    context.subscriptions.push(formattingProvider);
}

function startLanguageServer(context: vscode.ExtensionContext) {
    try {
        // Server module path
        const serverModule = context.asAbsolutePath(
            path.join('server', 'out', 'server.js')
        );

        // Check if server exists
        const fs = require('fs');
        if (!fs.existsSync(serverModule)) {
            console.log('Language server not found, running in basic mode');
            return;
        }

        // Server options
        const serverOptions: ServerOptions = {
            run: { module: serverModule, transport: TransportKind.ipc },
            debug: {
                module: serverModule,
                transport: TransportKind.ipc,
                options: { execArgv: ['--nolazy', '--inspect=0'] } // Use any available port
            }
        };

        // Client options
        const clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: 'outlinetext' }],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{content,otl}')
            },
            initializationFailedHandler: (error) => {
                console.log('Language server initialization failed:', error);
                vscode.window.showInformationMessage(
                    'OutlineText: Running in basic mode (Language server unavailable)'
                );
                return false; // Don't retry
            },
            // Completely disable diagnostics
            diagnosticCollectionName: undefined
        };

        // Create and start the client
        client = new LanguageClient(
            'outlineTextServer',
            'OutlineText Language Server',
            serverOptions,
            clientOptions
        );

        client.start().then(() => {
            console.log('OutlineText Language Server started successfully');
        }).catch((error) => {
            console.log('Language server failed to start:', error);
            client = undefined; // Clear client reference
        });

    } catch (error) {
        console.error('Failed to start language server:', error);
        client = undefined;
        // Don't show error to user, just run in basic mode
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    // Show Preview command
    const showPreviewCommand = vscode.commands.registerCommand(
        'outlinetext.showPreview',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'outlinetext') {
                vscode.window.showErrorMessage('Please open an OutlineText file first.');
                return;
            }

            try {
                await showPreview(editor.document);
            } catch (error) {
                console.error('Preview error:', error);
                vscode.window.showErrorMessage(`Preview failed: ${error}`);
            }
        }
    );

    // Export HTML command
    const exportHtmlCommand = vscode.commands.registerCommand(
        'outlinetext.exportHtml',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'outlinetext') {
                vscode.window.showErrorMessage('Please open an OutlineText file first.');
                return;
            }

            try {
                await exportAsHtml(editor.document);
            } catch (error) {
                console.error('Export error:', error);
                vscode.window.showErrorMessage(`Export failed: ${error}`);
            }
        }
    );

    context.subscriptions.push(showPreviewCommand, exportHtmlCommand);
}

let previewPanel: vscode.WebviewPanel | undefined;

async function showPreview(document: vscode.TextDocument) {
    const content = document.getText();

    // Try to get HTML from language server, fallback to basic conversion
    let html: string;
    try {
        if (client && client.isRunning()) {
            html = await client.sendRequest<string>('outlinetext/preview', {
                uri: document.uri.toString(),
                content: content
            });
        } else {
            html = basicOutlineTextToHtml(content);
        }
    } catch (error) {
        console.log('Language server not available, using basic parser');
        html = basicOutlineTextToHtml(content);
    }

    // Create or update preview panel
    if (previewPanel) {
        previewPanel.reveal(vscode.ViewColumn.Beside);
    } else {
        previewPanel = vscode.window.createWebviewPanel(
            'outlineTextPreview',
            `Preview: ${path.basename(document.fileName)}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        previewPanel.onDidDispose(() => {
            previewPanel = undefined;
        });
    }

    previewPanel.webview.html = getPreviewHtml(html);
}

async function exportAsHtml(document: vscode.TextDocument) {
    const content = document.getText();

    // Try to get HTML from language server, fallback to basic conversion
    let html: string;
    try {
        if (client && client.isRunning()) {
            html = await client.sendRequest<string>('outlinetext/preview', {
                uri: document.uri.toString(),
                content: content
            });
        } else {
            html = basicOutlineTextToHtml(content);
        }
    } catch (error) {
        html = basicOutlineTextToHtml(content);
    }

    const fullHtml = generateFullHtmlDocument(html, document.fileName);

    // Show save dialog
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(document.fileName.replace(/\.(content|otl)$/, '.html')),
        filters: {
            'HTML Files': ['html']
        }
    });

    if (saveUri) {
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(fullHtml, 'utf8'));
        vscode.window.showInformationMessage(`HTML exported to ${saveUri.fsPath}`);
    }
}

function basicOutlineTextToHtml(content: string): string {
    // Enhanced basic OutlineText to HTML conversion (fallback)
    const lines = content.split('\n');
    let html = '';
    let inCodeBlock = false;
    let codeBlockType = '';
    let inList = false;
    let listLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Handle code blocks
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                codeBlockType = line.trim().substring(3);
                inCodeBlock = true;
                html += `<pre><code class="language-${codeBlockType}">`;
            } else {
                inCodeBlock = false;
                html += '</code></pre>';
                codeBlockType = '';
            }
            continue;
        }

        if (inCodeBlock) {
            html += escapeHtml(line) + '\n';
            continue;
        }

        // Empty lines
        if (line.trim() === '') {
            if (inList) {
                html += '</ul>';
                inList = false;
                listLevel = 0;
            }
            html += '<br>';
            continue;
        }

        // Headers
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            if (inList) {
                html += '</ul>';
                inList = false;
                listLevel = 0;
            }
            const level = headerMatch[1].length;
            const text = processInlineElements(headerMatch[2]);
            html += `<h${level}>${text}</h${level}>`;
            continue;
        }

        // Lists
        const listMatch = line.match(/^(\s*)[\*\+\-]\s+(.+)$/);
        if (listMatch) {
            const indent = listMatch[1].length;
            const text = processInlineElements(listMatch[2]);

            if (!inList) {
                html += '<ul>';
                inList = true;
                listLevel = indent;
            }

            html += `<li>${text}</li>`;
            continue;
        }

        // Regular paragraphs
        if (inList) {
            html += '</ul>';
            inList = false;
            listLevel = 0;
        }

        if (line.trim() !== '') {
            html += `<p>${processInlineElements(line)}</p>`;
        }
    }

    // Close any open lists
    if (inList) {
        html += '</ul>';
    }

    return `<div class="outlinetext-parser-output">${html}</div>`;
}

function processInlineElements(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\/\/(.*?)\/\//g, '<em>$1</em>')
        .replace(/__(.*?)__/g, '<mark>$1</mark>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getPreviewHtml(content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OutlineText Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        
        .outlinetext-parser-output {
            max-width: 800px;
            margin: 0 auto;
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: var(--vscode-textLink-foreground);
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }
        
        p { margin-bottom: 1em; }
        
        code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        img {
            max-width: 100%;
            height: auto;
        }
        
        mark {
            background-color: var(--vscode-editor-findMatchHighlightBackground);
            color: var(--vscode-editor-foreground);
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
}

function generateFullHtmlDocument(content: string, title: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${path.basename(title, path.extname(title))}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Consolas', monospace;
        }
        img {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}