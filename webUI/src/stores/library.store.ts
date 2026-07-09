import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  createAssetKey,
  normalizeProjectEnvelope,
  type ProjectLibraries,
  type AudioLibraryItem,
  type EmotionPreset,
  type FilterLibraryItem,
  type TimbreLibraryItem
} from '../domain/project';
import { AssetRepository } from '../services/storage/assetRepository';
import { ProjectRepository } from '../services/storage/projectRepository';
import {
  createEmptyAudioLibraryItem,
  createEmptyEmotionPreset,
  createEmptyFilter,
  createEmptyTimbre,
  DEFAULT_FILTERS,
  isSystemEmotion,
  SYSTEM_EMOTIONS
} from './library.defaults';

const projectRepository = new ProjectRepository();
const assetRepository = new AssetRepository();

const cloneSystemEmotions = (): EmotionPreset[] => {
  return SYSTEM_EMOTIONS.map((item) => ({
    ...item,
    vector: [...item.vector]
  }));
};

const cloneDefaultFilters = (): FilterLibraryItem[] => {
  return DEFAULT_FILTERS.map((item) => ({
    ...item
  }));
};

export const useLibraryStore = defineStore('library', () => {
  const isHydrated = ref(false);
  const isSaving = ref(false);

  const timbres = ref<TimbreLibraryItem[]>([]);
  const emotionPresets = ref<EmotionPreset[]>(cloneSystemEmotions());
  const sfxLibrary = ref<AudioLibraryItem[]>([]);
  const bgmLibrary = ref<AudioLibraryItem[]>([]);
  const filterLibrary = ref<FilterLibraryItem[]>(cloneDefaultFilters());

  const customEmotionPresets = computed(() =>
    emotionPresets.value.filter((item) => !isSystemEmotion(item.name))
  );

  const applyEmotionLibrary = (loadedEmotions: EmotionPreset[] | undefined) => {
    if (loadedEmotions?.length) {
      const customLoaded = loadedEmotions.filter(
        (item) => !isSystemEmotion(item.name) && Array.isArray(item.vector)
      );
      const systemLoaded = loadedEmotions.filter((item) => isSystemEmotion(item.name));
      const mergedSystem = SYSTEM_EMOTIONS.map((item) => {
        const saved = systemLoaded.find((candidate) => candidate.name === item.name);
        return {
          ...item,
          vector: [...item.vector],
          enabled: saved?.enabled
        };
      });

      emotionPresets.value = [...mergedSystem, ...customLoaded];
      return;
    }

    emotionPresets.value = cloneSystemEmotions();
  };

  const persistLibraries = async () => {
    isSaving.value = true;

    try {
      await projectRepository.saveCurrentStatePatch({
        libraries: {
          sfx: sfxLibrary.value,
          bgm: bgmLibrary.value,
          timbres: timbres.value,
          filters: filterLibrary.value,
          emotions: emotionPresets.value
        },
        savedAt: Date.now()
      });
    } finally {
      isSaving.value = false;
    }
  };

  const hydrate = async () => {
    if (isHydrated.value) {
      return;
    }

    const loadedState = await projectRepository.loadCurrentState();
    const normalized = normalizeProjectEnvelope(loadedState ?? {});

    timbres.value = normalized.libraries.timbres;
    sfxLibrary.value = normalized.libraries.sfx.map((item) => ({
      ...item,
      volume: item.volume ?? 0.3
    }));
    bgmLibrary.value = normalized.libraries.bgm.map((item) => ({
      ...item,
      volume: item.volume ?? 0.3
    }));
    filterLibrary.value = normalized.libraries.filters.length
      ? normalized.libraries.filters
      : cloneDefaultFilters();
    applyEmotionLibrary(normalized.libraries.emotions);

    isHydrated.value = true;
  };

  const replaceLibraries = (libraries: ProjectLibraries) => {
    const normalized = normalizeProjectEnvelope({ libraries });
    timbres.value = normalized.libraries.timbres;
    sfxLibrary.value = normalized.libraries.sfx.map((item) => ({
      ...item,
      volume: item.volume ?? 0.3
    }));
    bgmLibrary.value = normalized.libraries.bgm.map((item) => ({
      ...item,
      volume: item.volume ?? 0.3
    }));
    filterLibrary.value = normalized.libraries.filters.length
      ? normalized.libraries.filters
      : cloneDefaultFilters();
    applyEmotionLibrary(normalized.libraries.emotions);
  };

  const saveTimbre = async (payload: TimbreLibraryItem) => {
    const nextValue = {
      ...payload,
      id: payload.id || Date.now().toString()
    };
    const existingIndex = timbres.value.findIndex((item) => item.id === nextValue.id);

    if (existingIndex === -1) {
      timbres.value.push(nextValue);
    } else {
      timbres.value[existingIndex] = nextValue;
    }

    await persistLibraries();
  };

  const deleteTimbre = async (id: string) => {
    timbres.value = timbres.value.filter((item) => item.id !== id);
    await persistLibraries();
  };

  const saveEmotionPreset = async (payload: EmotionPreset) => {
    if (isSystemEmotion(payload.name)) {
      throw new Error('无法修改或覆盖系统预设情绪');
    }

    const nextValue = {
      ...payload,
      id: payload.id || Date.now().toString()
    };
    const existingIndex = emotionPresets.value.findIndex((item) => item.id === nextValue.id);

    if (existingIndex === -1) {
      emotionPresets.value.push(nextValue);
    } else {
      emotionPresets.value[existingIndex] = nextValue;
    }

    await persistLibraries();
  };

  const deleteEmotionPreset = async (id: string) => {
    emotionPresets.value = emotionPresets.value.filter((item) => item.id !== id);
    await persistLibraries();
  };

  const resetEmotionsToDefault = async () => {
    emotionPresets.value = cloneSystemEmotions();
    await persistLibraries();
  };

  const saveAudioLibraryItem = async (
    collection: 'sfx' | 'bgm',
    payload: AudioLibraryItem
  ) => {
    const target = collection === 'sfx' ? sfxLibrary : bgmLibrary;
    const nextValue = {
      ...payload,
      id: payload.id || Date.now().toString(),
      enabled: payload.enabled !== false
    };
    const existingIndex = target.value.findIndex((item) => item.id === nextValue.id);

    if (existingIndex === -1) {
      target.value.push(nextValue);
    } else {
      target.value[existingIndex] = nextValue;
    }

    await persistLibraries();
  };

  const deleteAudioLibraryItem = async (collection: 'sfx' | 'bgm', id: string) => {
    const target = collection === 'sfx' ? sfxLibrary : bgmLibrary;
    target.value = target.value.filter((item) => item.id !== id);
    await persistLibraries();
  };

  const saveFilter = async (payload: FilterLibraryItem) => {
    const nextValue = {
      ...payload,
      id: payload.id || Date.now().toString(),
      frequency: Number(payload.frequency ?? 0),
      Q: Number(payload.Q ?? 0),
      gain: Number(payload.gain ?? 0),
      enabled: payload.enabled !== false
    };
    const existingIndex = filterLibrary.value.findIndex((item) => item.id === nextValue.id);

    if (existingIndex === -1) {
      filterLibrary.value.push(nextValue);
    } else {
      filterLibrary.value[existingIndex] = nextValue;
    }

    await persistLibraries();
  };

  const deleteFilter = async (id: string) => {
    filterLibrary.value = filterLibrary.value.filter((item) => item.id !== id);
    await persistLibraries();
  };

  const resetFiltersToDefault = async () => {
    filterLibrary.value = cloneDefaultFilters();
    await persistLibraries();
  };

  const saveTimbreFile = async (file: File, existingAssetKey = '') => {
    const assetKey = existingAssetKey || createAssetKey('timbre', file.name);
    await assetRepository.saveAsset(assetKey, file);
    return {
      assetKey,
      refPath: file.name
    };
  };

  const saveLibraryAudioFile = async (
    kind: 'sfx' | 'bgm',
    file: File,
    existingAssetKey = ''
  ) => {
    const assetKey = existingAssetKey || createAssetKey(kind, file.name);
    await assetRepository.saveAsset(assetKey, file);
    return {
      assetKey,
      filename: file.name
    };
  };

  return {
    isHydrated,
    isSaving,
    timbres,
    emotionPresets,
    customEmotionPresets,
    sfxLibrary,
    bgmLibrary,
    filterLibrary,
    hydrate,
    replaceLibraries,
    persistLibraries,
    saveTimbre,
    deleteTimbre,
    saveEmotionPreset,
    deleteEmotionPreset,
    resetEmotionsToDefault,
    saveAudioLibraryItem,
    deleteAudioLibraryItem,
    saveFilter,
    deleteFilter,
    resetFiltersToDefault,
    saveTimbreFile,
    saveLibraryAudioFile,
    createEmptyTimbre,
    createEmptyEmotionPreset,
    createEmptyAudioLibraryItem,
    createEmptyFilter,
    isSystemEmotion
  };
});
