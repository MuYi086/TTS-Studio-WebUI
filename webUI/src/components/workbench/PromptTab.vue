<script setup lang="ts">
/**
 * @fileoverview Prompt 管理标签页
 * @description 使用 Element Plus 维护脚本分析、音色分析与 Qwen 文本模板
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
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center gap-4">
          <h3 class="text-lg font-bold text-slate-700">自定义 Prompt 模板</h3>
          <el-space>
            <el-button type="primary" @click="savePrompt">
              <el-icon><Check /></el-icon>
              <span>保存设置</span>
            </el-button>
            <el-button @click="resetPrompt">
              <el-icon><RefreshLeft /></el-icon>
              <span>恢复默认</span>
            </el-button>
          </el-space>
        </div>
      </template>

      <section class="space-y-4">
        <h4 class="text-sm font-bold text-slate-600">1. 剧本拆分与分析 Prompt</h4>
        <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <el-switch v-model="useCustomPrompt" />
          <span class="text-sm font-bold text-slate-700">启用自定义 Prompt</span>
          <span class="text-xs text-slate-400">(关闭时将使用系统内置的默认 Prompt)</span>
        </div>

        <el-input
          v-model="customPromptTemplate"
          type="textarea"
          :rows="24"
          :disabled="!useCustomPrompt"
          resize="vertical"
          spellcheck="false"
          class="font-mono"
        />
        <div class="mt-2 text-xs text-slate-500">
          <span class="font-bold">可用变量:</span> ${sfxSection}, ${bgmSection}, ${bgmExampleLine}, ${sfxExample}, ${rawScript}
        </div>
      </section>

      <el-divider />

      <section class="space-y-4">
        <div class="flex justify-between items-center gap-4">
          <h4 class="text-sm font-bold text-slate-600">2. 角色音色分析 Prompt</h4>
          <el-space>
            <el-button type="primary" plain size="small" @click="saveVoicePrompt">保存音色Prompt</el-button>
            <el-button size="small" @click="resetVoicePrompt">恢复默认</el-button>
          </el-space>
        </div>
        <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <el-switch v-model="useCustomVoicePrompt" />
          <span class="text-sm font-bold text-slate-700">启用自定义音色分析 Prompt</span>
          <span class="text-xs text-slate-400">(关闭时将使用系统内置的默认 Prompt)</span>
        </div>
        <el-input
          v-model="customVoicePromptTemplate"
          type="textarea"
          :rows="8"
          :disabled="!useCustomVoicePrompt"
          resize="vertical"
          spellcheck="false"
          class="font-mono"
        />
        <div class="mt-2 text-xs text-slate-500">
          <span class="font-bold">可用变量:</span> ${charName}, ${rawScript}
        </div>
      </section>

      <el-divider />

      <section class="space-y-4">
        <div class="flex justify-between items-center gap-4">
          <h4 class="text-sm font-bold text-slate-600">3. Qwen 音色生成参考音频 文本模板</h4>
          <el-space>
            <el-button type="primary" plain size="small" @click="saveQwenVoiceText">保存生成文本</el-button>
            <el-button size="small" @click="resetQwenVoiceText">恢复默认</el-button>
          </el-space>
        </div>
        <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <el-switch v-model="useCustomQwenVoiceText" />
          <span class="text-sm font-bold text-slate-700">启用自定义生成文本</span>
          <span class="text-xs text-slate-400">(关闭时将使用系统内置的默认文本)</span>
        </div>
        <el-input
          v-model="customQwenVoiceTextTemplate"
          type="textarea"
          :rows="4"
          :disabled="!useCustomQwenVoiceText"
          resize="vertical"
          spellcheck="false"
          class="font-mono"
        />
        <div class="mt-2 text-xs text-slate-500">
          <span class="font-bold">可用变量:</span> ${charName}
        </div>
      </section>
    </el-card>
  </div>
</template>
