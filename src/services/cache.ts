interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 jam

export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearCache(): void {
  cache.clear();
}

/**
 * Statistik cache untuk public health check.
 * Hanya mengembalikan size agar tidak mengekspos URL internal.
 */
export function getCacheStats(): { size: number } {
  return {
    size: cache.size,
  };
}

/**
 * Statistik detail (hanya untuk development / admin).
 */
export function getCacheStatsDetailed(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
