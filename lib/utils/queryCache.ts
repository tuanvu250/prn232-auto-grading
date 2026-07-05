type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class QueryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  get<T>(key: string, staleTimeMs = 15000): { data: T | null; isStale: boolean } {
    const entry = this.cache.get(key);
    if (!entry) {
      return { data: null, isStale: true };
    }
    const isStale = Date.now() - entry.timestamp > staleTimeMs;
    return { data: entry.data as T, isStale };
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const queryCache = new QueryCache();
