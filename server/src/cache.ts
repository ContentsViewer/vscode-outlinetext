import crypto from 'crypto';
import type { ParseResult } from './shared/types';

export class CacheManager {
    private cache = new Map<string, CacheEntry>();
    private maxSize = 100; // Maximum number of cached items
    private maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds

    private generateKey(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    get(content: string): ParseResult | null {
        const key = this.generateKey(content);
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }

        // Update access time
        entry.lastAccess = Date.now();
        
        return entry.result;
    }

    set(content: string, result: ParseResult): void {
        const key = this.generateKey(content);
        
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        const entry: CacheEntry = {
            result,
            timestamp: Date.now(),
            lastAccess: Date.now(),
            size: content.length
        };

        this.cache.set(key, entry);
    }

    clear(): void {
        this.cache.clear();
    }

    getStats(): CacheStats {
        const entries = Array.from(this.cache.values());
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        const avgAge = entries.length > 0 
            ? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length 
            : 0;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            totalMemory: totalSize,
            averageAge: avgAge,
            hitRate: 0 // TODO: Implement hit rate tracking
        };
    }

    private evictOldest(): void {
        let oldestKey = '';
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccess < oldestTime) {
                oldestTime = entry.lastAccess;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
}

interface CacheEntry {
    result: ParseResult;
    timestamp: number;
    lastAccess: number;
    size: number;
}

interface CacheStats {
    size: number;
    maxSize: number;
    totalMemory: number;
    averageAge: number;
    hitRate: number;
}