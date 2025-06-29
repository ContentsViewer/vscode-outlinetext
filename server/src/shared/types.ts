// Shared types for OutlineText LSP

export interface ParseRequest {
    uri: string;
    content: string;
    options?: ParseOptions;
}

export interface ParseOptions {
    enableCache?: boolean;
    outputFormat?: 'html' | 'ast';
    maxSize?: number;
    sourceUri?: string; // URI of the source file for CURRENT_DIR replacement
}

export interface ParseResult {
    html: string;
    metadata?: ParseMetadata;
    diagnostics?: ParseDiagnostic[];
}

export interface ParseMetadata {
    parseTime: number;
    cacheHit?: boolean;
    references?: ReferenceInfo[];
    headings?: HeadingInfo[];
}

export interface ReferenceInfo {
    group: string;
    key: string;
    content: string;
    citations: number;
}

export interface HeadingInfo {
    level: number;
    text: string;
    line: number;
    id?: string;
}

export interface ParseDiagnostic {
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    code?: string;
}

// LSP Custom Messages
export namespace OutlineTextLSP {
    export const PARSE_REQUEST = 'outlinetext/parse';
    export const PREVIEW_REQUEST = 'outlinetext/preview';
    export const EXPORT_REQUEST = 'outlinetext/export';
}

// WASM Parser Interface
export interface WasmParser {
    initialize(): Promise<void>;
    parse(content: string, options?: ParseOptions): Promise<ParseResult>;
    isReady(): boolean;
    dispose(): void;
}

// Settings Interface
export interface OutlineTextSettings {
    enableCache: boolean;
    autoRefresh: boolean;
    diagnosticsEnabled: boolean;
    maxDocumentSize: number;
}