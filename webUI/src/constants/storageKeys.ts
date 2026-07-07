/**
 * @fileoverview 浏览器本地存储键名
 * @description 集中维护 localStorage 键名，避免不同模块硬编码不一致
 * @module src/constants/storageKeys
 */

export const STORAGE_KEYS = {
  activeTab: 'storyforge_activeTab',
  bgImageCount: 'unitale_bgImageCount',
  llmConfigs: 'storyforge_configs',
  legacyUniversalConfig: 'storyforge_universal_v2',
  currentLlmConfigId: 'unitale_llmConfigId',
  ttsConfigs: 'storyforge_tts_configs',
  currentTtsConfigId: 'unitale_ttsConfigId',
  promptTemplate: 'storyforge_prompt_template',
  useCustomPrompt: 'storyforge_use_custom_prompt',
  voicePromptTemplate: 'storyforge_voice_prompt_template',
  useCustomVoicePrompt: 'storyforge_use_custom_voice_prompt',
  qwenVoiceTextTemplate: 'storyforge_qwen_voice_text_template',
  useCustomQwenVoiceText: 'storyforge_use_custom_qwen_voice_text'
} as const
