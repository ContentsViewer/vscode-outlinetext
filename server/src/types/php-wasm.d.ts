declare module '@php-wasm/universal' {
    export interface PHPRunOptions {
        code: string;
    }
    
    export interface PHPRunResult {
        text: string;
        errors: string;
        exitCode: number;
    }
    
    export class PHP {
        constructor(runtime: any);
        run(options: PHPRunOptions): Promise<PHPRunResult>;
    }
}

declare module '@php-wasm/node' {
    export function loadNodeRuntime(version: string): Promise<any>;
    export function createNodeFsMountHandler(): any;
    export function useHostFilesystem(): any;
    export function withNetworking(): any;
}