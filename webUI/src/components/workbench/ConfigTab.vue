<script setup lang="ts">
/**
 * @fileoverview 模型配置标签页
 * @description 负责管理 LLM 与 TTS 服务配置
 * - LLM：配置 OpenAI 兼容模型参数
 * - TTS：配置语音合成服务地址
 * - 本地编辑：支持新增、编辑、删除配置
 * @module src/components/workbench/ConfigTab
 */
import { useWorkbenchContext } from '../../composables/useWorkbenchContext'

const {
  form,
  isEditing,
  saveConfig,
  resetForm,
  llmConfigs,
  editConfig,
  deleteConfig,
  isEditingTts,
  ttsForm,
  saveTtsConfig,
  resetTtsForm,
  ttsConfigs,
  editTtsConfig,
  deleteTtsConfig
} = useWorkbenchContext()
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-bold text-slate-800 border-b pb-2">LLM 模型配置（OpenAI通用接口）</h2>
    <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
      <h3 class="text-sm font-bold text-slate-700 mb-4">{{ isEditing ? '编辑配置' : '添加新配置' }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">配置名称</label>
          <input
            v-model="form.name"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="例如: Google Gemini"
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">模型名称</label>
          <input
            v-model="form.model"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="gemini-2.5-flash"
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Base URL</label>
          <input
            v-model="form.baseUrl"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">API Key</label>
          <input
            v-model="form.key"
            type="password"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="sk-..."
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            额外参数 (JSON格式，可选)
          </label>
          <input
            v-model="form.params"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder='例如: {"temperature": 0.7, "max_tokens": 2000}'
          />
        </div>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          @click.prevent="saveConfig"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
        >
          保存配置
        </button>
        <button
          v-if="isEditing"
          type="button"
          @click="resetForm"
          class="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-all"
        >
          取消
        </button>
      </div>
    </div>

    <div class="grid gap-3">
      <div
        v-for="conf in llmConfigs"
        :key="conf.id"
        class="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow"
      >
        <div>
          <div class="font-bold text-slate-800 text-sm">{{ conf.name }}</div>
          <div class="text-xs text-slate-400 mt-1">{{ conf.model }} | {{ conf.baseUrl }}</div>
        </div>
        <div class="flex gap-2">
          <button @click="editConfig(conf)" class="text-xs text-blue-600 hover:underline font-medium">编辑</button>
          <button @click="deleteConfig(conf.id)" class="text-xs text-red-500 hover:underline font-medium">删除</button>
        </div>
      </div>
      <div v-if="llmConfigs.length === 0" class="text-center py-8 text-slate-400 text-sm">暂无配置，请在上方添加</div>
    </div>

    <h2 class="text-lg font-bold text-slate-800 border-b pb-2 pt-6">TTS 语音合成配置</h2>
    <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
      <h3 class="text-sm font-bold text-slate-700 mb-4">{{ isEditingTts ? '编辑 TTS 配置' : '添加新 TTS 配置' }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">配置名称</label>
          <input
            v-model="ttsForm.name"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="例如: IndexTTS 2"
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Base URL</label>
          <input
            v-model="ttsForm.baseUrl"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="http://127.0.0.1:8300"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          @click.prevent="saveTtsConfig"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
        >
          保存配置
        </button>
        <button
          v-if="isEditingTts"
          type="button"
          @click="resetTtsForm"
          class="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-all"
        >
          取消
        </button>
      </div>
    </div>

    <div class="grid gap-3">
      <div
        v-for="conf in ttsConfigs"
        :key="conf.id"
        class="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow"
      >
        <div>
          <div class="font-bold text-slate-800 text-sm">{{ conf.name }}</div>
          <div class="text-xs text-slate-400 mt-1">{{ conf.baseUrl }}</div>
        </div>
        <div class="flex gap-2">
          <button @click="editTtsConfig(conf)" class="text-xs text-blue-600 hover:underline font-medium">编辑</button>
          <button @click="deleteTtsConfig(conf.id)" class="text-xs text-red-500 hover:underline font-medium">删除</button>
        </div>
      </div>
      <div v-if="ttsConfigs.length === 0" class="text-center py-8 text-slate-400 text-sm">暂无 TTS 配置，请在上方添加</div>
    </div>
  </div>
</template>
