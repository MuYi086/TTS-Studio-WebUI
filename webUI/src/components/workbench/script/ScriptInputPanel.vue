<script setup lang="ts">
/**
 * @fileoverview 脚本输入与批量控制面板
 * @description 使用 Element Plus 管理原文输入、LLM 分析、控制块插入、批量配音与顺序播放入口
 * @module src/components/workbench/script/ScriptInputPanel
 */
import { computed } from 'vue'
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'

const {
  rawScript,
  currentConfigId,
  llmConfigs,
  analyzeScript,
  isAnalyzingScript,
  addDialogueBlock,
  addBgmBlock,
  addBgImageBlock,
  bgImageCount,
  currentTtsConfigId,
  ttsConfigs,
  generateAllLines,
  isSequencePlaying,
  isGeneratingAll,
  selectedLineIndex,
  clearAllGeneratedAudio,
  playScriptSequentially,
  stopScriptSequentially
} = useWorkbenchContext()

const generateAllButtonLabel = computed(() => {
  if (isGeneratingAll.value) return '停止生成'
  return selectedLineIndex.value !== -1 ? '从选中行开始生成' : '一键生成配音(跳过已生成)'
})

const sequencePlaybackLabel = computed(() =>
  selectedLineIndex.value !== -1 ? '从选中位置播放' : '顺序播放'
)
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="font-bold text-slate-700">1. 输入原文 / 小说片段</div>
    </template>

    <el-input
      v-model="rawScript"
      type="textarea"
      :rows="9"
      resize="vertical"
      placeholder="请粘贴小说内容或剧本原文..."
      class="mb-4"
    />

    <el-row :gutter="12">
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <div class="font-bold text-xs text-slate-700 mb-2">AI 深度分析</div>
          <el-space direction="vertical" fill class="w-full">
            <el-select v-model="currentConfigId" placeholder="选择LLM模型" class="w-full">
              <el-option v-for="conf in llmConfigs" :key="conf.id" :label="conf.name" :value="conf.id" />
            </el-select>
            <el-button
              class="w-full"
              :type="isAnalyzingScript ? 'danger' : 'primary'"
              @click="analyzeScript"
            >
              {{ isAnalyzingScript ? '停止分析' : 'AI 深度分析' }}
            </el-button>
          </el-space>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <div class="font-bold text-xs text-slate-700 mb-2">插入控制块</div>
          <el-space wrap class="mb-3">
            <el-button type="primary" plain @click="addDialogueBlock">
              <el-icon><Plus /></el-icon>
              <span>插入台词</span>
            </el-button>
            <el-button type="warning" plain @click="addBgmBlock">
              <el-icon><Plus /></el-icon>
              <span>插入BGM</span>
            </el-button>
            <el-button type="success" plain @click="addBgImageBlock">
              <el-icon><Plus /></el-icon>
              <span>插入背景图片</span>
            </el-button>
          </el-space>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">背景图片数量</span>
            <el-input-number v-model="bgImageCount" :min="0" :max="100" size="small" />
            <span class="text-[10px] text-slate-400">张</span>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <div class="font-bold text-xs text-slate-700 mb-2">配音与播放</div>
          <el-space direction="vertical" fill class="w-full">
            <el-select v-model="currentTtsConfigId" placeholder="选择 TTS 模型" class="w-full">
              <el-option v-for="conf in ttsConfigs" :key="conf.id" :label="conf.name" :value="conf.id" />
            </el-select>
            <el-button
              class="w-full"
              :disabled="isSequencePlaying"
              :type="isGeneratingAll ? 'danger' : 'success'"
              @click="generateAllLines"
            >
              {{ generateAllButtonLabel }}
            </el-button>
            <el-button
              class="w-full"
              type="danger"
              plain
              :disabled="isSequencePlaying || isGeneratingAll"
              @click="clearAllGeneratedAudio"
            >
              清空配音
            </el-button>
            <el-button
              v-if="!isSequencePlaying"
              class="w-full"
              type="primary"
              :disabled="isGeneratingAll"
              @click="playScriptSequentially"
            >
              {{ sequencePlaybackLabel }}
            </el-button>
            <el-button v-else class="w-full" type="danger" @click="stopScriptSequentially">
              停止播放
            </el-button>
          </el-space>
        </el-card>
      </el-col>
    </el-row>
  </el-card>
</template>
