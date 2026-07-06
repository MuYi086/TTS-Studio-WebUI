<script setup lang="ts">
/**
 * @fileoverview 模型配置标签页
 * @description 使用 Element Plus 管理 LLM 与 TTS 服务配置
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
    <el-card shadow="never">
      <template #header>
        <div class="font-bold text-slate-800">LLM 模型配置（OpenAI通用接口）</div>
      </template>

      <el-form :model="form" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="配置名称">
              <el-input v-model="form.name" clearable placeholder="例如: Google Gemini" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="模型名称">
              <el-input v-model="form.model" clearable placeholder="gemini-2.5-flash" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="Base URL">
              <el-input v-model="form.baseUrl" clearable placeholder="https://generativelanguage.googleapis.com/v1beta/openai" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="API Key">
              <el-input v-model="form.key" type="password" show-password clearable placeholder="sk-..." />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="额外参数 (JSON格式，可选)">
              <el-input v-model="form.params" clearable placeholder='例如: {"temperature": 0.7, "max_tokens": 2000}' />
            </el-form-item>
          </el-col>
        </el-row>

        <el-space>
          <el-button type="primary" @click.prevent="saveConfig">
            <el-icon><Check /></el-icon>
            <span>保存配置</span>
          </el-button>
          <el-button v-if="isEditing" @click="resetForm">
            <el-icon><Close /></el-icon>
            <span>取消</span>
          </el-button>
        </el-space>
      </el-form>
    </el-card>

    <div class="grid gap-3">
      <el-card v-for="conf in llmConfigs" :key="conf.id" shadow="hover">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="font-bold text-slate-800 text-sm">{{ conf.name }}</div>
            <div class="text-xs text-slate-400 mt-1 break-all">{{ conf.model }} | {{ conf.baseUrl }}</div>
          </div>
          <el-space>
            <el-button type="primary" link @click="editConfig(conf)">编辑</el-button>
            <el-button type="danger" link @click="deleteConfig(conf.id)">删除</el-button>
          </el-space>
        </div>
      </el-card>
      <el-empty v-if="llmConfigs.length === 0" description="暂无配置，请在上方添加" />
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="font-bold text-slate-800">TTS 语音合成配置</div>
      </template>

      <el-form :model="ttsForm" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="配置名称">
              <el-input v-model="ttsForm.name" clearable placeholder="例如: IndexTTS 2" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Base URL">
              <el-input v-model="ttsForm.baseUrl" clearable placeholder="http://127.0.0.1:8300" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-space>
          <el-button type="primary" @click.prevent="saveTtsConfig">
            <el-icon><Check /></el-icon>
            <span>保存配置</span>
          </el-button>
          <el-button v-if="isEditingTts" @click="resetTtsForm">
            <el-icon><Close /></el-icon>
            <span>取消</span>
          </el-button>
        </el-space>
      </el-form>
    </el-card>

    <div class="grid gap-3">
      <el-card v-for="conf in ttsConfigs" :key="conf.id" shadow="hover">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="font-bold text-slate-800 text-sm">{{ conf.name }}</div>
            <div class="text-xs text-slate-400 mt-1 break-all">{{ conf.baseUrl }}</div>
          </div>
          <el-space>
            <el-button type="primary" link @click="editTtsConfig(conf)">编辑</el-button>
            <el-button type="danger" link @click="deleteTtsConfig(conf.id)">删除</el-button>
          </el-space>
        </div>
      </el-card>
      <el-empty v-if="ttsConfigs.length === 0" description="暂无 TTS 配置，请在上方添加" />
    </div>
  </div>
</template>
