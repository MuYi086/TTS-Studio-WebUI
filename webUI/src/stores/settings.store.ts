import { defineStore } from 'pinia';
import { ref } from 'vue';

import { PreferenceRepository } from '../services/storage/preferenceRepository';
import {
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_QWEN_VOICE_TEXT_TEMPLATE,
  DEFAULT_VOICE_PROMPT_TEMPLATE,
  STORAGE_KEYS,
  type LlmConfigItem,
  type TtsConfigItem
} from './settings.defaults';

const preferenceRepository = new PreferenceRepository();

const readJsonArray = <T>(key: string): T[] => {
  const value = preferenceRepository.getJson<unknown[]>(key);
  return Array.isArray(value) ? (value as T[]) : [];
};

export const useSettingsStore = defineStore('settings', () => {
  const isHydrated = ref(false);

  const llmConfigs = ref<LlmConfigItem[]>([]);
  const currentConfigId = ref('');

  const ttsConfigs = ref<TtsConfigItem[]>([]);
  const currentTtsConfigId = ref('');

  const customPromptTemplate = ref(DEFAULT_PROMPT_TEMPLATE);
  const useCustomPrompt = ref(false);

  const customVoicePromptTemplate = ref(DEFAULT_VOICE_PROMPT_TEMPLATE);
  const useCustomVoicePrompt = ref(false);

  const customQwenVoiceTextTemplate = ref(DEFAULT_QWEN_VOICE_TEXT_TEMPLATE);
  const useCustomQwenVoiceText = ref(false);

  const ensureCurrentLlmSelection = (preferredId = '') => {
    if (preferredId && llmConfigs.value.some((item) => item.id === preferredId)) {
      currentConfigId.value = preferredId;
      preferenceRepository.setString(STORAGE_KEYS.currentLlmConfigId, preferredId);
      return;
    }

    if (
      currentConfigId.value &&
      llmConfigs.value.some((item) => item.id === currentConfigId.value)
    ) {
      preferenceRepository.setString(STORAGE_KEYS.currentLlmConfigId, currentConfigId.value);
      return;
    }

    currentConfigId.value = llmConfigs.value[0]?.id ?? '';

    if (currentConfigId.value) {
      preferenceRepository.setString(STORAGE_KEYS.currentLlmConfigId, currentConfigId.value);
    } else {
      preferenceRepository.remove(STORAGE_KEYS.currentLlmConfigId);
    }
  };

  const ensureCurrentTtsSelection = (preferredId = '') => {
    if (preferredId && ttsConfigs.value.some((item) => item.id === preferredId)) {
      currentTtsConfigId.value = preferredId;
      preferenceRepository.setString(STORAGE_KEYS.currentTtsConfigId, preferredId);
      return;
    }

    if (
      currentTtsConfigId.value &&
      ttsConfigs.value.some((item) => item.id === currentTtsConfigId.value)
    ) {
      preferenceRepository.setString(
        STORAGE_KEYS.currentTtsConfigId,
        currentTtsConfigId.value
      );
      return;
    }

    currentTtsConfigId.value = ttsConfigs.value[0]?.id ?? '';

    if (currentTtsConfigId.value) {
      preferenceRepository.setString(
        STORAGE_KEYS.currentTtsConfigId,
        currentTtsConfigId.value
      );
    } else {
      preferenceRepository.remove(STORAGE_KEYS.currentTtsConfigId);
    }
  };

  const persistLlmConfigs = () => {
    preferenceRepository.setJson(STORAGE_KEYS.llmConfigs, llmConfigs.value);
  };

  const persistTtsConfigs = () => {
    preferenceRepository.setJson(STORAGE_KEYS.ttsConfigs, ttsConfigs.value);
  };

  const hydrate = () => {
    if (isHydrated.value) {
      return;
    }

    llmConfigs.value = readJsonArray<LlmConfigItem>(STORAGE_KEYS.llmConfigs);

    if (llmConfigs.value.length === 0) {
      const legacySingle = preferenceRepository.getJson<
        Partial<LlmConfigItem> & Record<string, unknown>
      >(STORAGE_KEYS.legacySingleLlm);

      if (legacySingle && legacySingle.baseUrl && legacySingle.key) {
        llmConfigs.value = [
          {
            id: typeof legacySingle.id === 'string' ? legacySingle.id : Date.now().toString(),
            name:
              typeof legacySingle.name === 'string' && legacySingle.name
                ? legacySingle.name
                : '默认配置',
            baseUrl: String(legacySingle.baseUrl ?? ''),
            model: String(legacySingle.model ?? ''),
            key: String(legacySingle.key ?? ''),
            params: String(legacySingle.params ?? '')
          }
        ];
        persistLlmConfigs();
        preferenceRepository.remove(STORAGE_KEYS.legacySingleLlm);
      }
    }

    currentConfigId.value =
      preferenceRepository.getString(STORAGE_KEYS.currentLlmConfigId) ?? '';
    ensureCurrentLlmSelection();

    ttsConfigs.value = readJsonArray<TtsConfigItem>(STORAGE_KEYS.ttsConfigs);
    currentTtsConfigId.value =
      preferenceRepository.getString(STORAGE_KEYS.currentTtsConfigId) ?? '';
    ensureCurrentTtsSelection();

    customPromptTemplate.value =
      preferenceRepository.getString(STORAGE_KEYS.promptTemplate) ??
      DEFAULT_PROMPT_TEMPLATE;
    useCustomPrompt.value =
      preferenceRepository.getJson<boolean>(STORAGE_KEYS.useCustomPrompt) ?? false;

    customVoicePromptTemplate.value =
      preferenceRepository.getString(STORAGE_KEYS.voicePromptTemplate) ??
      DEFAULT_VOICE_PROMPT_TEMPLATE;
    useCustomVoicePrompt.value =
      preferenceRepository.getJson<boolean>(STORAGE_KEYS.useCustomVoicePrompt) ?? false;

    customQwenVoiceTextTemplate.value =
      preferenceRepository.getString(STORAGE_KEYS.qwenVoiceTextTemplate) ??
      DEFAULT_QWEN_VOICE_TEXT_TEMPLATE;
    useCustomQwenVoiceText.value =
      preferenceRepository.getJson<boolean>(STORAGE_KEYS.useCustomQwenVoiceText) ?? false;

    isHydrated.value = true;
  };

  const saveLlmConfig = (payload: Omit<LlmConfigItem, 'id'> & { id?: string }) => {
    const savedId = payload.id || Date.now().toString();
    const nextValue: LlmConfigItem = {
      id: savedId,
      name: payload.name,
      baseUrl: payload.baseUrl.trim(),
      model: payload.model,
      key: payload.key.trim(),
      params: payload.params
    };
    const existingIndex = llmConfigs.value.findIndex((item) => item.id === savedId);

    if (existingIndex === -1) {
      llmConfigs.value.push(nextValue);
    } else {
      llmConfigs.value[existingIndex] = nextValue;
    }

    persistLlmConfigs();
    ensureCurrentLlmSelection(savedId);
  };

  const deleteLlmConfig = (id: string) => {
    llmConfigs.value = llmConfigs.value.filter((item) => item.id !== id);
    persistLlmConfigs();
    ensureCurrentLlmSelection();
  };

  const setCurrentConfigId = (id: string) => {
    currentConfigId.value = id;
    ensureCurrentLlmSelection(id);
  };

  const saveTtsConfig = (payload: Omit<TtsConfigItem, 'id'> & { id?: string }) => {
    const savedId = payload.id || Date.now().toString();
    const nextValue: TtsConfigItem = {
      id: savedId,
      name: payload.name,
      baseUrl: payload.baseUrl.trim()
    };
    const existingIndex = ttsConfigs.value.findIndex((item) => item.id === savedId);

    if (existingIndex === -1) {
      ttsConfigs.value.push(nextValue);
    } else {
      ttsConfigs.value[existingIndex] = nextValue;
    }

    persistTtsConfigs();
    ensureCurrentTtsSelection(savedId);
  };

  const deleteTtsConfig = (id: string) => {
    ttsConfigs.value = ttsConfigs.value.filter((item) => item.id !== id);
    persistTtsConfigs();
    ensureCurrentTtsSelection();
  };

  const setCurrentTtsConfigId = (id: string) => {
    currentTtsConfigId.value = id;
    ensureCurrentTtsSelection(id);
  };

  const setUseCustomPrompt = (value: boolean) => {
    useCustomPrompt.value = value;
    preferenceRepository.setJson(STORAGE_KEYS.useCustomPrompt, value);
  };

  const setUseCustomVoicePrompt = (value: boolean) => {
    useCustomVoicePrompt.value = value;
    preferenceRepository.setJson(STORAGE_KEYS.useCustomVoicePrompt, value);
  };

  const setUseCustomQwenVoiceText = (value: boolean) => {
    useCustomQwenVoiceText.value = value;
    preferenceRepository.setJson(STORAGE_KEYS.useCustomQwenVoiceText, value);
  };

  const persistPromptBundle = () => {
    preferenceRepository.setString(
      STORAGE_KEYS.promptTemplate,
      customPromptTemplate.value
    );
    preferenceRepository.setJson(STORAGE_KEYS.useCustomPrompt, useCustomPrompt.value);
    preferenceRepository.setString(
      STORAGE_KEYS.voicePromptTemplate,
      customVoicePromptTemplate.value
    );
    preferenceRepository.setJson(
      STORAGE_KEYS.useCustomVoicePrompt,
      useCustomVoicePrompt.value
    );
  };

  const persistVoicePrompt = () => {
    preferenceRepository.setString(
      STORAGE_KEYS.voicePromptTemplate,
      customVoicePromptTemplate.value
    );
    preferenceRepository.setJson(
      STORAGE_KEYS.useCustomVoicePrompt,
      useCustomVoicePrompt.value
    );
  };

  const persistQwenVoiceText = () => {
    preferenceRepository.setString(
      STORAGE_KEYS.qwenVoiceTextTemplate,
      customQwenVoiceTextTemplate.value
    );
    preferenceRepository.setJson(
      STORAGE_KEYS.useCustomQwenVoiceText,
      useCustomQwenVoiceText.value
    );
  };

  const resetPromptBundle = () => {
    customPromptTemplate.value = DEFAULT_PROMPT_TEMPLATE;
    customVoicePromptTemplate.value = DEFAULT_VOICE_PROMPT_TEMPLATE;
  };

  const resetVoicePrompt = () => {
    customVoicePromptTemplate.value = DEFAULT_VOICE_PROMPT_TEMPLATE;
    preferenceRepository.setString(
      STORAGE_KEYS.voicePromptTemplate,
      DEFAULT_VOICE_PROMPT_TEMPLATE
    );
  };

  const resetQwenVoiceText = () => {
    customQwenVoiceTextTemplate.value = DEFAULT_QWEN_VOICE_TEXT_TEMPLATE;
  };

  return {
    isHydrated,
    llmConfigs,
    currentConfigId,
    ttsConfigs,
    currentTtsConfigId,
    customPromptTemplate,
    useCustomPrompt,
    customVoicePromptTemplate,
    useCustomVoicePrompt,
    customQwenVoiceTextTemplate,
    useCustomQwenVoiceText,
    hydrate,
    saveLlmConfig,
    deleteLlmConfig,
    setCurrentConfigId,
    saveTtsConfig,
    deleteTtsConfig,
    setCurrentTtsConfigId,
    setUseCustomPrompt,
    setUseCustomVoicePrompt,
    setUseCustomQwenVoiceText,
    persistPromptBundle,
    persistVoicePrompt,
    persistQwenVoiceText,
    resetPromptBundle,
    resetVoicePrompt,
    resetQwenVoiceText
  };
});
