<script setup lang="ts">
/**
 * @fileoverview Prompt 管理标签页
 * @description 负责维护脚本分析、音色分析与 Qwen 文本模板
 * - 模板编辑：支持自定义多段 Prompt
 * - 开关控制：按模板粒度启停自定义内容
 * - 本地持久化：保存与恢复默认模板
 * @module src/components/workbench/PromptTab
 */
import { useWorkbenchContext } from '../../composables/useWorkbenchContext'

const {
  savePrompt,
  resetPrompt,
  useCustomPrompt,
  customPromptTemplate,
  saveVoicePrompt,
  resetVoicePrompt,
  useCustomVoicePrompt,
  customVoicePromptTemplate,
  saveQwenVoiceText,
  resetQwenVoiceText,
  useCustomQwenVoiceText,
  customQwenVoiceTextTemplate
} = useWorkbenchContext()
</script>

<template>
  <div class="space-y-6">
    <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-slate-700">自定义 Prompt 模板</h3>
        <div class="space-x-2">
          <button
            @click="savePrompt"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
          >
            保存设置
          </button>
          <button
            @click="resetPrompt"
            class="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-all"
          >
            恢复默认
          </button>
        </div>
      </div>

      <h4 class="text-sm font-bold text-slate-600 mb-2">1. 剧本拆分与分析 Prompt</h4>
      <div class="flex items-center gap-2 mb-4 bg-white p-3 rounded-lg border border-slate-200">
        <label class="relative inline-flex items-center cursor-pointer">
          <input v-model="useCustomPrompt" type="checkbox" class="sr-only peer" />
          <div
            class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
          <span class="ml-3 text-sm font-bold text-slate-700">启用自定义 Prompt</span>
        </label>
        <span class="text-xs text-slate-400 ml-2">(关闭时将使用系统内置的默认 Prompt)</span>
      </div>

      <textarea
        v-model="customPromptTemplate"
        :disabled="!useCustomPrompt"
        :class="['w-full h-[60vh] p-3 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3', !useCustomPrompt ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-700']"
        spellcheck="false"
      ></textarea>
      <div class="mt-2 text-xs text-slate-500">
        <span class="font-bold">可用变量:</span> ${sfxSection}, ${bgmSection}, ${bgmExampleLine}, ${sfxExample}, ${rawScript}
      </div>

      <hr class="my-6 border-slate-200" />

      <div class="flex justify-between items-center mb-2">
        <h4 class="text-sm font-bold text-slate-600">2. 角色音色分析 Prompt</h4>
        <div class="space-x-2">
          <button
            @click="saveVoicePrompt"
            class="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition-all"
          >
            保存音色Prompt
          </button>
          <button
            @click="resetVoicePrompt"
            class="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
          >
            恢复默认
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2 mb-4 bg-white p-3 rounded-lg border border-slate-200">
        <label class="relative inline-flex items-center cursor-pointer">
          <input v-model="useCustomVoicePrompt" type="checkbox" class="sr-only peer" />
          <div
            class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
          <span class="ml-3 text-sm font-bold text-slate-700">启用自定义音色分析 Prompt</span>
        </label>
        <span class="text-xs text-slate-400 ml-2">(关闭时将使用系统内置的默认 Prompt)</span>
      </div>
      <textarea
        v-model="customVoicePromptTemplate"
        :disabled="!useCustomVoicePrompt"
        :class="['w-full h-48 p-3 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3', !useCustomVoicePrompt ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-700']"
        spellcheck="false"
      ></textarea>
      <div class="mt-2 text-xs text-slate-500">
        <span class="font-bold">可用变量:</span> ${charName}, ${rawScript}
      </div>

      <hr class="my-6 border-slate-200" />

      <div class="flex justify-between items-center mb-2">
        <h4 class="text-sm font-bold text-slate-600">3. Qwen 音色生成参考音频 文本模板</h4>
        <div class="space-x-2">
          <button
            @click="saveQwenVoiceText"
            class="px-3 py-1.5 bg-pink-100 text-pink-700 rounded-lg text-xs font-bold hover:bg-pink-200 transition-all"
          >
            保存生成文本
          </button>
          <button
            @click="resetQwenVoiceText"
            class="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
          >
            恢复默认
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2 mb-4 bg-white p-3 rounded-lg border border-slate-200">
        <label class="relative inline-flex items-center cursor-pointer">
          <input v-model="useCustomQwenVoiceText" type="checkbox" class="sr-only peer" />
          <div
            class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
          ></div>
          <span class="ml-3 text-sm font-bold text-slate-700">启用自定义生成文本</span>
        </label>
        <span class="text-xs text-slate-400 ml-2">(关闭时将使用系统内置的默认文本)</span>
      </div>
      <textarea
        v-model="customQwenVoiceTextTemplate"
        :disabled="!useCustomQwenVoiceText"
        :class="['w-full h-24 p-3 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3', !useCustomQwenVoiceText ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-700']"
        spellcheck="false"
      ></textarea>
      <div class="mt-2 text-xs text-slate-500">
        <span class="font-bold">可用变量:</span> ${charName}
      </div>
    </div>
  </div>
</template>
