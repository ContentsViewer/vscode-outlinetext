/**
 * OutlineText Parser in JavaScript
 * Port of ContentsPlanet OutlineText.php functionality
 */

export interface ParseContext {
    html: string;
    headings: Array<{ level: number; text: string; line: number }>;
    references: Array<any>;
    diagnostics: Array<{ line: number; column: number; severity: 'error' | 'warning' | 'info'; message: string; code?: string }>;
}

export class OutlineTextParseContext implements ParseContext {
    html = '';
    headings: Array<{ level: number; text: string; line: number }> = [];
    references: Array<any> = [];
    diagnostics: Array<{ line: number; column: number; severity: 'error' | 'warning' | 'info'; message: string; code?: string }> = [];
    
    private content: string;
    
    constructor(content: string) {
        this.content = content;
    }
    
    appendHtml(html: string): void {
        this.html += html;
    }
    
    addHeading(level: number, text: string, line: number): void {
        this.headings.push({ level, text, line });
    }
    
    addDiagnostic(line: number, column: number, severity: 'error' | 'warning' | 'info', message: string, code?: string): void {
        this.diagnostics.push({ line, column, severity, message, code });
    }
}

export class MorphSequence {
    private lines: string[];
    private index = 0;
    
    constructor(lines: string[]) {
        this.lines = lines;
    }
    
    current(): string {
        return this.lines[this.index] || '';
    }
    
    next(): string {
        this.index++;
        return this.current();
    }
    
    peek(offset = 1): string {
        return this.lines[this.index + offset] || '';
    }
    
    isEnd(): boolean {
        return this.index >= this.lines.length;
    }
    
    getCurrentLineNumber(): number {
        return this.index;
    }
}

abstract class BlockParser {
    abstract canParse(sequence: MorphSequence, context: OutlineTextParseContext): boolean;
    abstract parse(sequence: MorphSequence, context: OutlineTextParseContext): void;
    
    protected escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    protected processInlineElements(text: string): string {
        return text
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic  
            .replace(/\/\/(.*?)\/\//g, '<em>$1</em>')
            // Mark/Highlight
            .replace(/__(.*?)__/g, '<mark>$1</mark>')
            // Strikethrough
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            // Links
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
            // Images
            .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }
}

class HeaderParser extends BlockParser {
    canParse(sequence: MorphSequence, context: OutlineTextParseContext): boolean {
        return /^(#{1,6})\s+(.+)$/.test(sequence.current());
    }
    
    parse(sequence: MorphSequence, context: OutlineTextParseContext): void {
        const line = sequence.current();
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        
        if (match) {
            const level = match[1].length;
            const rawText = match[2];
            const processedText = this.processInlineElements(rawText);
            
            context.appendHtml(`<h${level}>${processedText}</h${level}>`);
            context.addHeading(level, rawText, sequence.getCurrentLineNumber());
        }
        
        sequence.next();
    }
}

class ListParser extends BlockParser {
    canParse(sequence: MorphSequence, context: OutlineTextParseContext): boolean {
        return /^(\s*)[\*\+\-]\s+(.+)$/.test(sequence.current());
    }
    
    parse(sequence: MorphSequence, context: OutlineTextParseContext): void {
        context.appendHtml('<ul>');
        
        while (!sequence.isEnd() && this.canParse(sequence, context)) {
            const line = sequence.current();
            const match = line.match(/^(\s*)[\*\+\-]\s+(.+)$/);
            
            if (match) {
                const text = this.processInlineElements(match[2]);
                context.appendHtml(`<li>${text}</li>`);
            }
            
            sequence.next();
        }
        
        context.appendHtml('</ul>');
    }
}

class CodeBlockParser extends BlockParser {
    canParse(sequence: MorphSequence, context: OutlineTextParseContext): boolean {
        const line = sequence.current().trim();
        return line === '```' || line.startsWith('```');
    }
    
    parse(sequence: MorphSequence, context: OutlineTextParseContext): void {
        const firstLine = sequence.current().trim();
        const language = firstLine.substring(3);
        
        context.appendHtml(`<pre><code class="language-${language}">`);
        sequence.next();
        
        while (!sequence.isEnd() && sequence.current().trim() !== '```') {
            context.appendHtml(this.escapeHtml(sequence.current()) + '\n');
            sequence.next();
        }
        
        context.appendHtml('</code></pre>');
        
        if (!sequence.isEnd()) {
            sequence.next(); // Skip closing ```
        }
    }
}

class ParagraphParser extends BlockParser {
    canParse(sequence: MorphSequence, context: OutlineTextParseContext): boolean {
        return sequence.current().trim() !== '';
    }
    
    parse(sequence: MorphSequence, context: OutlineTextParseContext): void {
        const line = sequence.current();
        
        if (line.trim() !== '') {
            const processedText = this.processInlineElements(line);
            context.appendHtml(`<p>${processedText}</p>`);
        }
        
        sequence.next();
    }
}

class EmptyLineParser extends BlockParser {
    canParse(sequence: MorphSequence, context: OutlineTextParseContext): boolean {
        return sequence.current().trim() === '';
    }
    
    parse(sequence: MorphSequence, context: OutlineTextParseContext): void {
        context.appendHtml('<br>');
        sequence.next();
    }
}

export class OutlineTextJSParser {
    private blockParsers: BlockParser[];
    
    constructor() {
        this.blockParsers = [
            new HeaderParser(),
            new CodeBlockParser(),
            new ListParser(),
            new EmptyLineParser(),
            new ParagraphParser() // Should be last
        ];
    }
    
    parse(content: string, context: OutlineTextParseContext): ParseContext {
        const lines = content.split('\n');
        const sequence = new MorphSequence(lines);
        
        while (!sequence.isEnd()) {
            this.parseBlock(sequence, context);
        }
        
        // Wrap in container
        context.html = `<div class="outlinetext-parser-output">${context.html}</div>`;
        
        return context;
    }
    
    private parseBlock(sequence: MorphSequence, context: OutlineTextParseContext): void {
        for (const parser of this.blockParsers) {
            if (parser.canParse(sequence, context)) {
                parser.parse(sequence, context);
                return;
            }
        }
        
        // Should not reach here, but skip line if no parser matches
        sequence.next();
    }
}