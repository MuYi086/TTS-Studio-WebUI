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

const readBoolean = (key: string, fallback = false): boolean => {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback

  try {
    return Boolean(JSON.parse(raw))
  } catch {
    return fallback
  }
}

/**
 * 创建 Prompt 模板管理器。
 * @returns Prompt 状态、当前有效模板和保存/恢复动作。
 */
export function usePromptTemplates() {
  const customPromptTemplate = ref(
    localStorage.getItem('storyforge_prompt_template') || DEFAULT_PROMPT_TEMPLATE
  )
  const useCustomPrompt = ref(readBoolean('storyforge_use_custom_prompt'))

  const customVoicePromptTemplate = ref(
    localStorage.getItem('storyforge_voice_prompt_template') || DEFAULT_VOICE_PROMPT_TEMPLATE
  )
  const useCustomVoicePrompt = ref(readBoolean('storyforge_use_custom_voice_prompt'))

  const customQwenVoiceTextTemplate = ref(
    localStorage.getItem('storyforge_qwen_voice_text_template') || DEFAULT_QWEN_VOICE_TEXT_TEMPLATE
  )
  const useCustomQwenVoiceText = ref(readBoolean('storyforge_use_custom_qwen_voice_text'))

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
    localStorage.setItem('storyforge_prompt_template', customPromptTemplate.value)
    localStorage.setItem('storyforge_use_custom_prompt', JSON.stringify(useCustomPrompt.value))
    localStorage.setItem('storyforge_voice_prompt_template', customVoicePromptTemplate.value)
    localStorage.setItem('storyforge_use_custom_voice_prompt', JSON.stringify(useCustomVoicePrompt.value))
    alert('Prompt 设置已保存')
  }

  const saveVoicePrompt = (): void => {
    localStorage.setItem('storyforge_voice_prompt_template', customVoicePromptTemplate.value)
    localStorage.setItem('storyforge_use_custom_voice_prompt', JSON.stringify(useCustomVoicePrompt.value))
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
    localStorage.setItem('storyforge_voice_prompt_template', DEFAULT_VOICE_PROMPT_TEMPLATE)
  }

  const saveQwenVoiceText = (): void => {
    localStorage.setItem('storyforge_qwen_voice_text_template', customQwenVoiceTextTemplate.value)
    localStorage.setItem('storyforge_use_custom_qwen_voice_text', JSON.stringify(useCustomQwenVoiceText.value))
    alert('Qwen 生成文本设置已保存')
  }

  const resetQwenVoiceText = (): void => {
    if (!confirm('确定要恢复默认文本吗？')) return

    customQwenVoiceTextTemplate.value = DEFAULT_QWEN_VOICE_TEXT_TEMPLATE
  }

  watch(useCustomPrompt, newValue => {
    localStorage.setItem('storyforge_use_custom_prompt', JSON.stringify(newValue))
  })

  watch(useCustomVoicePrompt, newValue => {
    localStorage.setItem('storyforge_use_custom_voice_prompt', JSON.stringify(newValue))
  })

  watch(useCustomQwenVoiceText, newValue => {
    localStorage.setItem('storyforge_use_custom_qwen_voice_text', JSON.stringify(newValue))
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
