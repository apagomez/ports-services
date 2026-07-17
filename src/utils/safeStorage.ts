const memoryFallback: Record<string, string> = {};

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Access denied to localStorage.getItem("${key}"). Using memory fallback.`, e);
      return memoryFallback[key] !== undefined ? memoryFallback[key] : null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[SafeStorage] Access denied to localStorage.setItem("${key}"). Using memory fallback.`, e);
      memoryFallback[key] = value;
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[SafeStorage] Access denied to localStorage.removeItem("${key}"). Using memory fallback.`, e);
      delete memoryFallback[key];
    }
  },

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn(`[SafeStorage] Access denied to localStorage.clear(). Clearing memory fallback.`, e);
      for (const key in memoryFallback) {
        delete memoryFallback[key];
      }
    }
  }
};
