import type { JsonObject, TimbreLibraryItem, VoiceLookup } from './types';

export const cloneData = <T>(value: T): T => {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

export const createId = (prefix = 'id'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

export const sanitizeFilename = (name: unknown): string => {
  const cleaned = String(name ?? 'asset')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned || 'asset';
};

export const createAssetKey = (kind = 'asset', filename?: unknown): string => {
  const safeName = sanitizeFilename(filename).slice(-48);
  return `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${safeName || 'file'}`;
};

export const ensureArray = <T>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};

export const asObject = (value: unknown): JsonObject => {
  return value && typeof value === 'object' ? (value as JsonObject) : {};
};

export const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

export const normalizeTrimRange = (
  item: JsonObject,
  defaultStart: number,
  defaultEnd: number
): Pick<JsonObject, never> & { trimStart: number; trimEnd: number } => {
  const start = clamp(toNumber(item.trimStart, defaultStart), 0, 1);
  let end = clamp(toNumber(item.trimEnd, defaultEnd), 0, 1);

  if (end <= start) {
    end = Math.min(1, start + 0.01);
  }

  return { trimStart: start, trimEnd: end };
};

export const isExternalAssetPath = (value: string): boolean => {
  return /^(https?:\/\/|blob:|data:)/.test(value);
};

export const createVoiceLookup = (timbres: TimbreLibraryItem[]): VoiceLookup => {
  const byPath = new Map<string, string>();
  const byName = new Map<string, TimbreLibraryItem>();

  ensureArray<TimbreLibraryItem>(timbres).forEach((timbre) => {
    if (timbre.refPath && timbre.assetKey && !byPath.has(timbre.refPath)) {
      byPath.set(timbre.refPath, timbre.assetKey);
    }

    if (timbre.name && !byName.has(timbre.name)) {
      byName.set(timbre.name, timbre);
    }
  });

  return { byPath, byName };
};
