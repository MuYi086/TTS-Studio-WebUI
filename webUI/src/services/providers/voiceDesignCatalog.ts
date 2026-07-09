export interface VoiceDesignOption {
  name: string;
  url: string;
}

export const DEFAULT_VOICE_DESIGNS: VoiceDesignOption[] = [
  { name: 'Qwen', url: 'http://127.0.0.1:8300/v1/qwen/design' },
  { name: 'MIMO', url: 'http://127.0.0.1:8300/v1/mimo/design' }
];

const normalizeVoiceDesign = (value: unknown): VoiceDesignOption | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (typeof source.name !== 'string' || typeof source.url !== 'string') {
    return null;
  }

  const name = source.name.trim();
  const url = source.url.trim();

  if (!name || !url) {
    return null;
  }

  return { name, url };
};

export const loadVoiceDesignOptions = (): VoiceDesignOption[] => {
  const windowValue = (globalThis as Record<string, unknown>).voiceDesigns;

  if (!Array.isArray(windowValue)) {
    return [...DEFAULT_VOICE_DESIGNS];
  }

  const normalized = windowValue
    .map(normalizeVoiceDesign)
    .filter((item): item is VoiceDesignOption => item !== null);

  return normalized.length > 0 ? normalized : [...DEFAULT_VOICE_DESIGNS];
};
