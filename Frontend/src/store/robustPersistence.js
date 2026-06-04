/**
 * Centralized Zustand Persistence Middleware
 * Handles localStorage quota errors and read/write failures gracefully.
 * Replaces per-store persist configuration with a unified error-handling layer.
 */

const STORAGE_KEY_PREFIX = 'helpdesk-storage:';

/**
 * Create a robust persistence layer that handles:
 * - Quota exceeded errors
 * - Corrupted JSON
 * - Missing keys
 * - Type errors
 */
export const createRobustPersistence = (storageKey) => {
    const key = `${STORAGE_KEY_PREFIX}${storageKey}`;

    return {
        getItem: () => {
            try {
                const value = localStorage.getItem(key);
                if (value === null) return null;
                const parsed = JSON.parse(value);
                return parsed;
            } catch (e) {
                console.warn(`[RobustPersistence] Failed to read "${key}":`, e.message);
                // Attempt recovery: remove corrupted entry
                try {
                    localStorage.removeItem(key);
                } catch (_) {
                    // ignore
                }
                return null;
            }
        },

        setItem: (_, value) => {
            try {
                const serialized = JSON.stringify(value);
                localStorage.setItem(key, serialized);
                return true;
            } catch (e) {
                if (
                    e.name === 'QuotaExceededError' ||
                    e.message.includes('QuotaExceeded') ||
                    e.message.includes('disk space') ||
                    e.message.includes('storage limit')
                ) {
                    console.error(`[RobustPersistence] Storage quota exceeded for "${key}". Attempting cleanup...`);
                    // Evict oldest non-essential entries
                    evictOldEntries(key);
                    // Retry once after cleanup
                    try {
                        const serialized = JSON.stringify(value);
                        localStorage.setItem(key, serialized);
                        console.log(`[RobustPersistence] Retry succeeded after cleanup.`);
                        return true;
                    } catch (retryErr) {
                        console.error(`[RobustPersistence] Retry also failed. Storage fully exhausted.`);
                        return false;
                    }
                } else {
                    console.error(`[RobustPersistence] Failed to write "${key}":`, e.message);
                    return false;
                }
            }
        },

        removeItem: () => {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn(`[RobustPersistence] Failed to remove "${key}":`, e.message);
            }
        },
    };
};

/**
 * Evict old storage entries when quota is exceeded.
 * Keeps the current key, removes others oldest-first.
 */
const evictOldEntries = (currentKey) => {
    const PREFIX = STORAGE_KEY_PREFIX;
    const entries = [];

    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && k !== currentKey) {
            try {
                const item = localStorage.getItem(k);
                const parsed = JSON.parse(item);
                entries.push({
                    key: k,
                    timestamp: parsed?.state?._persist?.lastUpdate || 0,
                    size: item.length,
                });
            } catch (_) {
                // Can't read, remove it
                localStorage.removeItem(k);
            }
        }
    }

    // Sort by timestamp oldest first
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove entries until we have enough space
    // Heuristic: remove all entries older than 24h, or just remove oldest 3
    const toRemove = entries.filter(e => e.timestamp < Date.now() - 86400000).slice(0, 5);
    for (const entry of toRemove) {
        console.log(`[RobustPersistence] Evicting: ${entry.key}`);
        localStorage.removeItem(entry.key);
    }
};

/**
 * Zustand middleware: robustPersist
 * Use this instead of the plain `persist` middleware for all stores.
 *
 * Usage:
 *   import { create } from 'zustand';
 *   import { robustPersist } from './robustPersistence';
 *
 *   const useStore = create(robustPersist(
 *     (set) => ({ ... }),
 *     { key: 'my-store', allowErrors: true }
 *   ));
 */
export const robustPersist = (config, options = {}) => {
    const { key, allowErrors = true } = options;

    // Dynamically import persist middleware
    // This avoids bundling it when not needed
    let persistMiddleware;
    try {
        const zustand = require('zustand');
        persistMiddleware = zustand.persist;
    } catch (e) {
        console.error("[robustPersist] zustand not found");
        return config;
    }

    const storage = key ? createRobustPersistence(key) : undefined;

    return persistMiddleware(config, {
        name: key ? `${STORAGE_KEY_PREFIX}${key}` : undefined,
        storage: storage || undefined,
        onError: allowErrors
            ? (error) => {
                  console.error("[robustPersist] Storage error:", error);
              }
            : undefined,
        ...options,
    });
};
