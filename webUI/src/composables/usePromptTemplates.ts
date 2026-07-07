/**
 * @fileoverview Prompt 模板状态管理
 * @description 维护脚本分析、音色分析和 Qwen 文本模板的自定义状态与持久化
 * @module src/composables/usePromptTemplates
 */
import { computed, ref, watch } from 'vue'
import {
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_QWEN_VOICE_TEXT_TEMPLATE,
  DEFAULT_VOICE_PROMPT_TEMPLATE
} from '../constants/promptTemplates'
import { STORAGE_KEYS } from '../constants/storageKeys'
import { readLocalBoolean, readLocalText, writeLocalBoolean, writeLocalText } from '../utils/storage'

/**
 * 创建 Prompt 模板管理器。
 * @returns Prompt 状态、当前有效模板和保存/恢复动作。
 */
export function usePromptTemplates() {
  const customPromptTemplate = ref(
    readLocalText(STORAGE_KEYS.promptTemplate) || DEFAULT_PROMPT_TEMPLATE
  )
  const useCustomPrompt = ref(readLocalBoolean(STORAGE_KEYS.useCustomPrompt))

  const customVoicePromptTemplate = ref(
    readLocalText(STORAGE_KEYS.voicePromptTemplate) || DEFAULT_VOICE_PROMPT_TEMPLATE
  )
  const useCustomVoicePrompt = ref(readLocalBoolean(STORAGE_KEYS.useCustomVoicePrompt))

  const customQwenVoiceTextTemplate = ref(
    readLocalText(STORAGE_KEYS.qwenVoiceTextTemplate) || DEFAULT_QWEN_VOICE_TEXT_TEMPLATE
  )
  const useCustomQwenVoiceText = ref(readLocalBoolean(STORAGE_KEYS.useCustomQwenVoiceText))

  const scriptPromptTemplate = computed(() => {
    return useCustomPrompt.value ? customPromptTemplate.value : DEFAULT_PROMPT_TEMPLATE
  })

  const voicePromptTemplate = computed(() => {
    return useCustomVoicePrompt.value
      ? customVoicePromptTemplate.value
      : DEFAULT_VOICE_PROMPT_TEMPLATE
  })

  const qwenVoiceTextTemplate = computed(() => {
    return useCustomQwenVoiceText.value
      ? customQwenVoiceTextTemplate.value
      : DEFAULT_QWEN_VOICE_TEXT_TEMPLATE
  })

  const savePrompt = (): void => {
    writeLocalText(STORAGE_KEYS.promptTemplate, customPromptTemplate.value)
    writeLocalBoolean(STORAGE_KEYS.useCustomPrompt, useCustomPrompt.value)
    writeLocalText(STORAGE_KEYS.voicePromptTemplate, customVoicePromptTemplate.value)
    writeLocalBoolean(STORAGE_KEYS.useCustomVoicePrompt, useCustomVoicePrompt.value)
    alert('Prompt 设置已保存')
  }

  const saveVoicePrompt = (): void => {
    writeLocalText(STORAGE_KEYS.voicePromptTemplate, customVoicePromptTemplate.value)
    writeLocalBoolean(STORAGE_KEYS.useCustomVoicePrompt, useCustomVoicePrompt.value)
    alert('音色分析 Prompt 设置已保存')
  }

  const resetPrompt = (): void => {
    if (!confirm('确定要恢复默认 Prompt 吗？')) return

    customPromptTemplate.value = DEFAULT_PROMPT_TEMPLATE
    customVoicePromptTemplate.value = DEFAULT_VOICE_PROMPT_TEMPLATE
  }

  const resetVoicePrompt = (): void => {
    if (!confirm('确定要恢复默认的音色分析 Prompt 吗？')) return

    customVoicePromptTemplate.value = DEFAULT_VOICE_PROMPT_TEMPLATE
    writeLocalText(STORAGE_KEYS.voicePromptTemplate, DEFAULT_VOICE_PROMPT_TEMPLATE)
  }

  const saveQwenVoiceText = (): void => {
    writeLocalText(STORAGE_KEYS.qwenVoiceTextTemplate, customQwenVoiceTextTemplate.value)
    writeLocalBoolean(STORAGE_KEYS.useCustomQwenVoiceText, useCustomQwenVoiceText.value)
    alert('Qwen 生成文本设置已保存')
  }

  const resetQwenVoiceText = (): void => {
    if (!confirm('确定要恢复默认文本吗？')) return

    customQwenVoiceTextTemplate.value = DEFAULT_QWEN_VOICE_TEXT_TEMPLATE
  }

  watch(useCustomPrompt, newValue => {
    writeLocalBoolean(STORAGE_KEYS.useCustomPrompt, newValue)
  })

  watch(useCustomVoicePrompt, newValue => {
    writeLocalBoolean(STORAGE_KEYS.useCustomVoicePrompt, newValue)
  })

  watch(useCustomQwenVoiceText, newValue => {
    writeLocalBoolean(STORAGE_KEYS.useCustomQwenVoiceText, newValue)
  })

  return {
    customPromptTemplate,
    useCustomPrompt,
    scriptPromptTemplate,
    customVoicePromptTemplate,
    useCustomVoicePrompt,
    voicePromptTemplate,
    customQwenVoiceTextTemplate,
    useCustomQwenVoiceText,
    qwenVoiceTextTemplate,
    savePrompt,
    saveVoicePrompt,
    resetPrompt,
    resetVoicePrompt,
    saveQwenVoiceText,
    resetQwenVoiceText
  }
}
