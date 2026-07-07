/**
 * @fileoverview 模型配置状态管理
 * @description 维护 LLM 与 TTS 配置、当前选中配置和本地持久化
 * @module src/composables/useModelConfigs
 */
import { computed, ref, watch } from 'vue'
import { STORAGE_KEYS } from '../constants/storageKeys'
import type { LlmConfig, TtsConfig } from '../types/workbench'
import { readLocalJson, readLocalText, removeLocalValue, writeLocalJson, writeLocalText } from '../utils/storage'

const emptyLlmConfig = (): LlmConfig => ({
  id: '',
  name: '',
  baseUrl: '',
  model: '',
  key: '',
  params: ''
})

const emptyTtsConfig = (): TtsConfig => ({
  id: '',
  name: '',
  baseUrl: ''
})

/**
 * 创建 LLM 与 TTS 配置管理器。
 * @returns 模型配置状态、当前配置和增删改动作。
 */
export function useModelConfigs() {
  const llmConfigs = ref<LlmConfig[]>([])
  const currentConfigId = ref('')
  const form = ref<LlmConfig>(emptyLlmConfig())
  const isEditing = ref(false)

  const ttsConfigs = ref<TtsConfig[]>([])
  const currentTtsConfigId = ref('')
  const ttsForm = ref<TtsConfig>(emptyTtsConfig())
  const isEditingTts = ref(false)

  const currentConfig = computed(() => {
    return llmConfigs.value.find(config => config.id === currentConfigId.value) || null
  })

  const currentTtsConfig = computed(() => {
    return ttsConfigs.value.find(config => config.id === currentTtsConfigId.value) || null
  })

  const saveConfigsToLocal = (): void => {
    writeLocalJson(STORAGE_KEYS.llmConfigs, llmConfigs.value)
  }

  const saveTtsConfigsToLocal = (): void => {
    writeLocalJson(STORAGE_KEYS.ttsConfigs, ttsConfigs.value)
  }

  const resetForm = (): void => {
    form.value = emptyLlmConfig()
    isEditing.value = false
  }

  const resetTtsForm = (): void => {
    ttsForm.value = emptyTtsConfig()
    isEditingTts.value = false
  }

  const saveConfig = (): void => {
    if (!form.value.name || !form.value.baseUrl || !form.value.key) {
      alert('请填写完整信息')
      return
    }

    form.value.baseUrl = form.value.baseUrl.trim()
    form.value.key = form.value.key.trim()

    if (isEditing.value) {
      const index = llmConfigs.value.findIndex(config => config.id === form.value.id)
      if (index !== -1) llmConfigs.value[index] = { ...form.value }
    } else {
      llmConfigs.value.push({ ...form.value, id: Date.now().toString() })
    }

    saveConfigsToLocal()
    resetForm()

    if (llmConfigs.value.length === 1) {
      currentConfigId.value = llmConfigs.value[0].id
    }
  }

  const editConfig = (config: LlmConfig): void => {
    form.value = { ...config }
    isEditing.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteConfig = (id: string): void => {
    if (!confirm('确定删除此配置吗？')) return

    llmConfigs.value = llmConfigs.value.filter(config => config.id !== id)
    saveConfigsToLocal()
    if (currentConfigId.value === id) currentConfigId.value = ''
  }

  const saveTtsConfig = (): void => {
    if (!ttsForm.value.name || !ttsForm.value.baseUrl) {
      alert('请填写完整信息')
      return
    }

    ttsForm.value.baseUrl = ttsForm.value.baseUrl.trim()

    if (isEditingTts.value) {
      const index = ttsConfigs.value.findIndex(config => config.id === ttsForm.value.id)
      if (index !== -1) ttsConfigs.value[index] = { ...ttsForm.value }
    } else {
      ttsConfigs.value.push({ ...ttsForm.value, id: Date.now().toString() })
    }

    saveTtsConfigsToLocal()
    resetTtsForm()
  }

  const editTtsConfig = (config: TtsConfig): void => {
    ttsForm.value = { ...config }
    isEditingTts.value = true
  }

  const deleteTtsConfig = (id: string): void => {
    if (!confirm('确定删除此 TTS 配置吗？')) return

    ttsConfigs.value = ttsConfigs.value.filter(config => config.id !== id)
    saveTtsConfigsToLocal()
    if (currentTtsConfigId.value === id) currentTtsConfigId.value = ''
  }

  const loadConfigsFromLocal = (): void => {
    llmConfigs.value = readLocalJson<LlmConfig[]>(STORAGE_KEYS.llmConfigs, [])

    if (llmConfigs.value.length === 0) {
      const legacyConfig = readLocalJson<Partial<LlmConfig> | null>(
        STORAGE_KEYS.legacyUniversalConfig,
        null
      )

      if (legacyConfig) {
        llmConfigs.value.push({
          ...emptyLlmConfig(),
          ...legacyConfig,
          id: Date.now().toString(),
          name: legacyConfig.name || '默认配置'
        })
        removeLocalValue(STORAGE_KEYS.legacyUniversalConfig)
        saveConfigsToLocal()
      }
    }

    const savedLlmId = readLocalText(STORAGE_KEYS.currentLlmConfigId)
    if (savedLlmId && llmConfigs.value.some(config => config.id === savedLlmId)) {
      currentConfigId.value = savedLlmId
    } else if (llmConfigs.value.length > 0) {
      currentConfigId.value = llmConfigs.value[0].id
    }
  }

  const loadTtsConfigsFromLocal = (): void => {
    ttsConfigs.value = readLocalJson<TtsConfig[]>(STORAGE_KEYS.ttsConfigs, [])

    const savedTtsId = readLocalText(STORAGE_KEYS.currentTtsConfigId)
    if (savedTtsId && ttsConfigs.value.some(config => config.id === savedTtsId)) {
      currentTtsConfigId.value = savedTtsId
    } else if (ttsConfigs.value.length > 0) {
      currentTtsConfigId.value = ttsConfigs.value[0].id
    }
  }

  watch(currentConfigId, newId => {
    if (newId) writeLocalText(STORAGE_KEYS.currentLlmConfigId, newId)
  })

  watch(currentTtsConfigId, newId => {
    if (newId) writeLocalText(STORAGE_KEYS.currentTtsConfigId, newId)
  })

  loadConfigsFromLocal()
  loadTtsConfigsFromLocal()

  return {
    llmConfigs,
    currentConfigId,
    form,
    isEditing,
    currentConfig,
    saveConfig,
    editConfig,
    deleteConfig,
    resetForm,
    ttsConfigs,
    currentTtsConfigId,
    ttsForm,
    isEditingTts,
    currentTtsConfig,
    saveTtsConfig,
    editTtsConfig,
    deleteTtsConfig,
    resetTtsForm
  }
}
