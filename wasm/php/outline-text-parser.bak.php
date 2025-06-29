<?php
/**
 * OutlineText Parser for WASM
 * Simplified version of ContentsPlanet OutlineText.php for WebAssembly compilation
 */

class OutlineTextParser {
    private $context;
    private $blockParsers = [];
    
    public function __construct() {
        $this->context = new ParseContext();
        $this->initializeBlockParsers();
    }
    
    public function parse($content) {
        $this->context->reset();
        $this->context->setText($content);
        
        $lines = explode("\n", $content);
        $morphSequence = new MorphSequence($lines);
        
        while (!$morphSequence->isEnd()) {
            $this->parseBlock($morphSequence);
        }
        
        return [
            'html' => $this->context->getHtml(),
            'metadata' => $this->context->getMetadata(),
            'diagnostics' => $this->context->getDiagnostics()
        ];
    }
    
    private function initializeBlockParsers() {
        $this->blockParsers = [
            new HeaderParser(),
            new ListParser(),
            new CodeBlockParser(),
            new ParagraphParser()
        ];
    }
    
    private function parseBlock($morphSequence) {
        foreach ($this->blockParsers as $parser) {
            if ($parser->canParse($morphSequence, $this->context)) {
                $parser->parse($morphSequence, $this->context);
                return;
            }
        }
        
        // Skip line if no parser can handle it
        $morphSequence->next();
    }
}

class ParseContext {
    private $html = '';
    private $metadata = [];
    private $diagnostics = [];
    private $text = '';
    
    public function reset() {
        $this->html = '';
        $this->metadata = [];
        $this->diagnostics = [];
        $this->text = '';
    }
    
    public function setText($text) {
        $this->text = $text;
    }
    
    public function appendHtml($html) {
        $this->html .= $html;
    }
    
    public function addDiagnostic($line, $column, $severity, $message) {
        $this->diagnostics[] = [
            'line' => $line,
            'column' => $column,
            'severity' => $severity,
            'message' => $message
        ];
    }
    
    public function addHeading($level, $text, $line) {
        if (!isset($this->metadata['headings'])) {
            $this->metadata['headings'] = [];
        }
        $this->metadata['headings'][] = [
            'level' => $level,
            'text' => $text,
            'line' => $line
        ];
    }
    
    public function getHtml() {
        return '<div class="outlinetext-parser-output">' . $this->html . '</div>';
    }
    
    public function getMetadata() {
        return $this->metadata;
    }
    
    public function getDiagnostics() {
        return $this->diagnostics;
    }
}

class MorphSequence {
    private $lines;
    private $index = 0;
    
    public function __construct($lines) {
        $this->lines = $lines;
    }
    
    public function current() {
        return $this->lines[$this->index] ?? '';
    }
    
    public function next() {
        $this->index++;
        return $this->current();
    }
    
    public function peek($offset = 1) {
        return $this->lines[$this->index + $offset] ?? '';
    }
    
    public function isEnd() {
        return $this->index >= count($this->lines);
    }
    
    public function getCurrentLineNumber() {
        return $this->index;
    }
}

abstract class BlockParser {
    abstract public function canParse($morphSequence, $context);
    abstract public function parse($morphSequence, $context);
    
    protected function escapeHtml($text) {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    }
    
    protected function processInlineElements($text) {
        // Bold
        $text = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $text);
        // Italic
        $text = preg_replace('/\/\/(.*?)\/\//', '<em>$1</em>', $text);
        // Mark
        $text = preg_replace('/__(.*?)__/', '<mark>$1</mark>', $text);
        // Strike
        $text = preg_replace('/~~(.*?)~~/', '<del>$1</del>', $text);
        // Links
        $text = preg_replace('/\[(.*?)\]\((.*?)\)/', '<a href="$2">$1</a>', $text);
        // Images
        $text = preg_replace('/!\[(.*?)\]\((.*?)\)/', '<img src="$2" alt="$1" loading="lazy" />', $text);
        // Inline code
        $text = preg_replace('/`([^`]+)`/', '<code>$1</code>', $text);
        
        return $text;
    }
}

class HeaderParser extends BlockParser {
    public function canParse($morphSequence, $context) {
        return preg_match('/^(#{1,6})\s+(.+)$/', $morphSequence->current());
    }
    
    public function parse($morphSequence, $context) {
        $line = $morphSequence->current();
        if (preg_match('/^(#{1,6})\s+(.+)$/', $line, $matches)) {
            $level = strlen($matches[1]);
            $text = $this->processInlineElements($matches[2]);
            
            $context->appendHtml("<h{$level}>{$text}</h{$level}>");
            $context->addHeading($level, $matches[2], $morphSequence->getCurrentLineNumber());
        }
        $morphSequence->next();
    }
}

class ListParser extends BlockParser {
    public function canParse($morphSequence, $context) {
        return preg_match('/^(\s*)[\*\+\-]\s+(.+)$/', $morphSequence->current());
    }
    
    public function parse($morphSequence, $context) {
        $context->appendHtml('<ul>');
        
        while (!$morphSequence->isEnd() && $this->canParse($morphSequence, $context)) {
            $line = $morphSequence->current();
            if (preg_match('/^(\s*)[\*\+\-]\s+(.+)$/', $line, $matches)) {
                $text = $this->processInlineElements($matches[2]);
                $context->appendHtml("<li>{$text}</li>");
            }
            $morphSequence->next();
        }
        
        $context->appendHtml('</ul>');
    }
}

class CodeBlockParser extends BlockParser {
    public function canParse($morphSequence, $context) {
        return trim($morphSequence->current()) === '```' || 
               strpos(trim($morphSequence->current()), '```') === 0;
    }
    
    public function parse($morphSequence, $context) {
        $line = trim($morphSequence->current());
        $language = substr($line, 3);
        
        $context->appendHtml("<pre><code class=\"language-{$language}\">");
        $morphSequence->next();
        
        while (!$morphSequence->isEnd() && trim($morphSequence->current()) !== '```') {
            $context->appendHtml($this->escapeHtml($morphSequence->current()) . "\n");
            $morphSequence->next();
        }
        
        $context->appendHtml('</code></pre>');
        if (!$morphSequence->isEnd()) {
            $morphSequence->next(); // Skip closing ```
        }
    }
}

class ParagraphParser extends BlockParser {
    public function canParse($morphSequence, $context) {
        return trim($morphSequence->current()) !== '';
    }
    
    public function parse($morphSequence, $context) {
        $line = $morphSequence->current();
        if (trim($line) !== '') {
            $text = $this->processInlineElements($line);
            $context->appendHtml("<p>{$text}</p>");
        } else {
            $context->appendHtml('<br>');
        }
        $morphSequence->next();
    }
}

// JavaScript interface function
function parseOutlineText($content) {
    $parser = new OutlineTextParser();
    return json_encode($parser->parse($content));
}

?>