import path from 'path';
import fs from 'fs/promises';
import type { WasmParser, ParseOptions, ParseResult, ParseDiagnostic } from './shared/types';

// PHP WASM interface
interface PhpWasm {
    run(code: string): string;
    setPhpCode(code: string): void;
    call(functionName: string, ...args: any[]): any;
}

export class OutlineTextParser implements WasmParser {
    private isInitialized = false;
    private wasmModule: any = null;
    private phpModule: any = null;

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Try to load actual PHP WASM with correct API
            await this.initializePhpWasm();
            console.log('PHP WASM parser initialized successfully.');

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize WASM parser:', error);
            throw new Error(`WASM parser initialization failed: ${error}`);
        }
    }

    async parse(content: string, options: ParseOptions = {}): Promise<ParseResult> {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (this.wasmModule === null) {
            throw new Error('WASM parser is not initialized');
        }

        const startTime = Date.now();

        try {
            // Use WASM parser if available, fallback to mock
            const result = await this.wasmParse(content, options);

            const parseTime = Date.now() - startTime;

            return {
                ...result,
                metadata: {
                    ...result.metadata,
                    parseTime
                }
            };
        } catch (error) {
            console.error('Parse error:', error);
            throw error;
        }
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    dispose(): void {
        if (this.phpModule) {
            // Cleanup WASM module
            this.phpModule = null;
        }

        if (this.wasmModule) {
            this.wasmModule = null;
        }

        this.isInitialized = false;
    }

    private async initializePhpWasm(): Promise<void> {
        try {
            // Import correct modules according to documentation
            const { PHP } = await import('@php-wasm/universal');
            const { loadNodeRuntime } = await import('@php-wasm/node');

            // Load PHP runtime for Node.js and create PHP instance
            const runtime = await loadNodeRuntime('8.3');
            this.phpModule = new PHP(runtime);

            {
                // Load our OutlineText parser PHP code
                const phpCodePath = path.join(__dirname, '../../wasm/php/OutlineText.php');
                const phpCode = await fs.readFile(phpCodePath, 'utf-8');
                await this.phpModule.writeFile('OutlineText.php', phpCode);

                // Execute the PHP code to register functions
                const result = await this.phpModule.run({
                    code: `<?php
                    require_once "OutlineText.php";
                    OutlineText\\Parser::Init();
                    ?>`
                });

                if (result.errors) {
                    console.error('PHP errors:', result.errors);
                    throw new Error('PHP initialization failed: ' + result.errors);
                }
            }

            this.wasmModule = this.phpModule;
        } catch (error) {
            console.error('PHP WASM initialization failed:', error);
            throw error;
        }
    }

    private async wasmParse(content: string, options: ParseOptions): Promise<ParseResult> {
        try {
            if (!this.phpModule) {
                throw new Error('PHP WASM not initialized');
            }

            // Normalize line endings: remove CR characters to get LF-only
            let normalizedContent = content.replace(/\r/g, '');

            // Replace CURRENT_DIR with actual directory path if sourceUri is provided
            let currentDir: string = '.';
            if (options.sourceUri) {
                const sourceUri = options.sourceUri;
                currentDir = path.dirname(sourceUri).replace(/\\/g, '/');
            }

            // Use Base64 encoding for safe in-memory transfer
            const base64Content = Buffer.from(normalizedContent, 'utf-8').toString('base64');
            const base64CurrentDir = Buffer.from(currentDir, 'utf-8').toString('base64');

            // Call PHP function through WASM using correct API
            const result = await this.phpModule.run({
                code: `<?php
                    require_once "OutlineText.php";
                    use OutlineText\\Parser;

                    $content = base64_decode('${base64Content}');
                    $currentDir = base64_decode('${base64CurrentDir}');
                    
                    $context = new OutlineText\\Context();
                    $context->pathMacros = [['CURRENT_DIR'], [$currentDir]];
                    $html = Parser::Parse($content, $context);
                    echo json_encode(['html' => $html, 'metadata' => [], 'diagnostics' => []]);
                ?>`
            });


            if (result.errors) {
                console.error('PHP execution errors:', result.errors);
                throw new Error('PHP execution failed: ' + result.errors);
            }

            const parsed = JSON.parse(result.text || '{}');

            return {
                html: parsed.html || '',
                metadata: {
                    parseTime: 0,
                    references: [],
                    headings: parsed.metadata?.headings || [],
                    ...parsed.metadata
                },
                diagnostics: parsed.diagnostics || []
            };
        } catch (error) {
            console.error('WASM parse error:', error);
            throw error;
        }
    }


}

// Export for testing
export { OutlineTextParser as default };