export class PreferenceRepository {
  getString(key: string): string | null {
    return localStorage.getItem(key);
  }

  getJson<T>(key: string): T | null {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setString(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  setJson<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}
