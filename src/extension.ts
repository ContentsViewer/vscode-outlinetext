import * as vscode from 'vscode';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    console.log('OutlineText extension is now active');

    // Store extension context globally
    extensionContext = context;

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

    context.subscriptions.push(showPreviewCommand);
}

let previewPanel: vscode.WebviewPanel | undefined;

async function showPreview(document: vscode.TextDocument) {
    const content = document.getText();

    // Try to get HTML from language server, fallback to basic conversion
    let html: string;
    if (!client || !client.isRunning()) {
        throw new Error('Language server is not running');
    }
    try {
        html = await client.sendRequest<string>('outlinetext/preview', {
            uri: document.uri.toString(),
            content: content
        });

    } catch (error) {
        console.log('Language server not available, using basic parser');
        html = `error: ${error}`;
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
                retainContextWhenHidden: true,
                localResourceRoots: [
                    extensionContext.extensionUri,
                    vscode.Uri.file(path.dirname(document.uri.fsPath)) // Allow access to document's directory
                ]
            }
        );

        previewPanel.onDidDispose(() => {
            previewPanel = undefined;
        });

        // Listen for messages from the webview for debugging
        previewPanel.webview.onDidReceiveMessage((message) => {
            switch (message.type) {
                case 'log':
                    console.log('[Webview]', message.level, message.args);
                    break;
                case 'error':
                    console.error('[Webview Error]', message.message, message.stack);
                    break;
            }
        });
    }

    // Process HTML to convert local image paths to webview URIs
    const processedHtml = processImagePaths(html, document.uri, previewPanel.webview);

    // Get extension context to access resource URIs
    previewPanel.webview.html = getPreviewHtml(processedHtml, previewPanel.webview, extensionContext);
}

/**
 * Convert local image paths in HTML to webview-compatible URIs
 */
function processImagePaths(html: string, documentUri: vscode.Uri, webview: vscode.Webview): string {
    const documentDir = path.dirname(documentUri.fsPath);
    
    // Replace local file paths in <img> tags with webview URIs
    return html.replace(/<img\s+([^>]*?)src\s*=\s*['"](file:\/\/\/[^'"]*?)['"]([^>]*?)>/gi, (match, prefix, src, suffix) => {
        try {
            // Extract the file path from the file:/// URI
            const filePath = decodeURIComponent(src.replace('file:///', ''));
            const imageUri = vscode.Uri.file(filePath);
            const webviewUri = webview.asWebviewUri(imageUri);
            
            console.log(`Converting image path: ${src} -> ${webviewUri.toString()}`);
            return `<img ${prefix}src="${webviewUri.toString()}"${suffix}>`;
        } catch (error) {
            console.warn(`Failed to convert image path: ${src}`, error);
            return match; // Return original if conversion fails
        }
    });
}


function getPreviewHtml(content: string, webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'style.css'));
    const loadMathJaxJsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'load-mathjax.js'));
    const loadSyntaxHighlighterJsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'load-syntaxhighlighter.js'));
    const debugJsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'debug.js'));

    // Create resource map for SyntaxHighlighter
    const syntaxHighlighterResources = new Map([
        ['styles/shCoreDefault.css', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'styles', 'shCoreDefault.css')).toString()],
        ['scripts/shCore.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shCore.js')).toString()],
        ['scripts/shAutoloader.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shAutoloader.js')).toString()],
        ['scripts/shBrushAppleScript.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushAppleScript.js')).toString()],
        ['scripts/shBrushAS3.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushAS3.js')).toString()],
        ['scripts/shBrushBash.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushBash.js')).toString()],
        ['scripts/shBrushColdFusion.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushColdFusion.js')).toString()],
        ['scripts/shBrushCpp.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushCpp.js')).toString()],
        ['scripts/shBrushCSharp.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushCSharp.js')).toString()],
        ['scripts/shBrushCss.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushCss.js')).toString()],
        ['scripts/shBrushDelphi.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushDelphi.js')).toString()],
        ['scripts/shBrushDiff.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushDiff.js')).toString()],
        ['scripts/shBrushErlang.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushErlang.js')).toString()],
        ['scripts/shBrushGroovy.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushGroovy.js')).toString()],
        ['scripts/shBrushJava.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushJava.js')).toString()],
        ['scripts/shBrushJavaFX.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushJavaFX.js')).toString()],
        ['scripts/shBrushJScript.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushJScript.js')).toString()],
        ['scripts/shBrushPerl.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushPerl.js')).toString()],
        ['scripts/shBrushPhp.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushPhp.js')).toString()],
        ['scripts/shBrushPlain.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushPlain.js')).toString()],
        ['scripts/shBrushPowerShell.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushPowerShell.js')).toString()],
        ['scripts/shBrushPython.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushPython.js')).toString()],
        ['scripts/shBrushRuby.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushRuby.js')).toString()],
        ['scripts/shBrushSass.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushSass.js')).toString()],
        ['scripts/shBrushScala.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushScala.js')).toString()],
        ['scripts/shBrushSql.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushSql.js')).toString()],
        ['scripts/shBrushVb.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushVb.js')).toString()],
        ['scripts/shBrushXml.js', webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'webview-public', 'syntaxhighlighter', 'scripts', 'shBrushXml.js')).toString()]
    ]);

    // Convert Map to Object for JSON serialization
    const resourcesObject = Object.fromEntries(syntaxHighlighterResources);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OutlineText Preview</title>
    <link rel="stylesheet" href="${styleUri}">
    <script>        
        // Provide resource map
        window.SyntaxHighlighterResources = ${JSON.stringify(resourcesObject)};
        
        console.log('Webview initialized with resources:', Object.keys(window.SyntaxHighlighterResources));
    </script>
    <script src="${debugJsUri}"></script>
    <script src="${loadSyntaxHighlighterJsUri}"></script>
    <script src="${loadMathJaxJsUri}"></script>
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