import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { OutlineTextParser } from './parser';
import { CacheManager } from './cache';
import type { ParseRequest, ParseResult, OutlineTextSettings } from './shared/types';

// LSP Connection
const connection = createConnection(ProposedFeatures.all);

// Document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Parser and cache
const parser = new OutlineTextParser();
const cache = new CacheManager();

// Settings
let globalSettings: OutlineTextSettings = {
    enableCache: true,
    autoRefresh: true,
    diagnosticsEnabled: true,
    maxDocumentSize: 1024 * 1024 // 1MB
};

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['[', '*', '#', '!']
            },
            // Explicitly disable diagnostic capabilities
            diagnosticProvider: undefined
        }
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }

    return result;
});

connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }

    // Initialize WASM parser
    try {
        await parser.initialize();
        connection.console.log('OutlineText WASM parser initialized successfully');
    } catch (error) {
        connection.console.error('Failed to initialize WASM parser: ' + error);
    }
});

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        cache.clear();
    } else {
        globalSettings = <OutlineTextSettings>(
            (change.settings.outlinetext || globalSettings)
        );
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

// Document change handler
documents.onDidChangeContent(change => {
    if (globalSettings.autoRefresh) {
        validateTextDocument(change.document);
    }
});

// Custom LSP requests
connection.onRequest('outlinetext/parse', async (params: ParseRequest): Promise<ParseResult> => {
    try {
        const content = params.content;
        const options = params.options || {};

        // Check cache
        if (globalSettings.enableCache && options.enableCache !== false) {
            const cached = cache.get(content);
            if (cached) {
                return {
                    ...cached,
                    metadata: {
                        parseTime: cached.metadata?.parseTime || 0,
                        ...cached.metadata,
                        cacheHit: true
                    }
                };
            }
        }

        // Parse with WASM
        const result = await parser.parse(content, options);

        // Store in cache
        if (globalSettings.enableCache) {
            cache.set(content, result);
        }

        return result;
    } catch (error) {
        connection.console.error('Parse error: ' + error);
        throw error;
    }
});

connection.onRequest('outlinetext/preview', async (params: ParseRequest): Promise<string> => {
    try {
        const content = params.content;
        const options = params.options || {};
        console.log("params.uri:",params.uri);
        const result = await parser.parse(content, options);
        return result.html;
    } catch (error) {
        connection.console.error('Preview error: ' + error);
        throw error;
    }
});

// Simplified Diagnostics
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    if (!globalSettings.diagnosticsEnabled) {
        return;
    }

    try {
        const content = textDocument.getText();
        const diagnostics: Diagnostic[] = [];
        
        // Size check
        if (content.length > globalSettings.maxDocumentSize) {
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                },
                message: 'Document is too large for real-time parsing',
                source: 'outlinetext'
            };
            diagnostics.push(diagnostic);
        }

        // Basic syntax validation
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            // Check for unmatched brackets
            const openBrackets = (line.match(/\[/g) || []).length;
            const closeBrackets = (line.match(/\]/g) || []).length;
            
            if (openBrackets !== closeBrackets) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: { line: index, character: 0 },
                        end: { line: index, character: line.length }
                    },
                    message: 'Unmatched brackets detected',
                    source: 'outlinetext'
                });
            }
        });

        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    } catch (error) {
        connection.console.error('Validation error: ' + error);
    }
}

// Completion
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        return [
            {
                label: '**bold**',
                kind: CompletionItemKind.Snippet,
                data: 1,
                insertText: '**${1:text}**',
                detail: 'Bold text'
            },
            {
                label: '//italic//',
                kind: CompletionItemKind.Snippet,
                data: 2,
                insertText: '//${1:text}//',
                detail: 'Italic text'
            },
            {
                label: '[link](url)',
                kind: CompletionItemKind.Snippet,
                data: 3,
                insertText: '[${1:text}](${2:url})',
                detail: 'Link'
            },
            {
                label: '![image](url)',
                kind: CompletionItemKind.Snippet,
                data: 4,
                insertText: '![${1:alt}](${2:url})',
                detail: 'Image'
            }
        ];
    }
);

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item;
    }
);

// Handle diagnostic requests explicitly to avoid errors
connection.onRequest('textDocument/diagnostic', () => {
    // Return empty diagnostics to satisfy VS Code
    return {
        kind: 'full',
        items: []
    };
});

// Handle any unhandled methods gracefully (if supported)
if ('onUnhandledMethod' in connection) {
    (connection as any).onUnhandledMethod = (method: string, params: any) => {
        console.log(`Unhandled method: ${method}`);
        return null;
    };
}

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();

// Cleanup on exit
process.on('exit', () => {
    parser.dispose();
    cache.clear();
});