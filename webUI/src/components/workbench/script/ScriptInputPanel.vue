<script setup lang="ts">
/**
 * @fileoverview 脚本输入与批量控制面板
 * @description 管理原文输入、LLM 分析、控制块插入、批量配音与顺序播放入口
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
  <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-sm font-bold text-slate-700">1. 输入原文 / 小说片段</h3>
    </div>

    <textarea
      v-model="rawScript"
      class="w-full p-4 border rounded-xl h-48 mb-4 focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-slate-50 text-sm leading-relaxed"
      placeholder="请粘贴小说内容或剧本原文..."
    ></textarea>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div class="font-bold text-xs text-slate-700">AI 深度分析</div>
        <select
          v-model="currentConfigId"
          class="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-full"
          title="选择用于分析的 LLM 模型"
        >
          <option value="" disabled>-- 选择LLM模型 --</option>
          <option v-for="conf in llmConfigs" :key="conf.id" :value="conf.id">{{ conf.name }}</option>
        </select>
        <button
          :class="['w-full px-3 py-2 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center', isAnalyzingScript ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50']"
          @click="analyzeScript"
        >
          <span v-if="isAnalyzingScript" class="animate-spin mr-2">...</span>
          {{ isAnalyzingScript ? '停止分析' : 'AI 深度分析' }}
        </button>
      </div>

      <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div class="font-bold text-xs text-slate-700">插入控制块</div>
        <div class="flex flex-wrap gap-2">
          <button class="px-2 py-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-200 transition-all" @click="addDialogueBlock">+ 插入台词</button>
          <button class="px-2 py-2 bg-purple-100 text-purple-600 rounded-lg text-sm font-bold hover:bg-purple-200 transition-all" @click="addBgmBlock">+ 插入BGM</button>
          <button class="px-2 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-200 transition-all" @click="addBgImageBlock">+ 插入背景图片</button>
        </div>
        <div class="flex flex-wrap items-center gap-2 px-2 py-2 bg-white border border-slate-200 rounded-lg">
          <label class="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">背景图片数量</label>
          <input
            v-model.number="bgImageCount"
            type="number"
            min="0"
            max="100"
            class="w-20 px-2 py-1 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            title="LLM 将严格插入的 bgImage 块数量"
          />
          <span class="text-[10px] text-slate-400 whitespace-nowrap">张</span>
          <span class="text-[10px] text-slate-400 ml-2">（若需关闭，可从Prompt管理中删除背景图片块相关提示词）</span>
        </div>
      </div>

      <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div class="font-bold text-xs text-slate-700">配音与播放</div>
        <select
          v-model="currentTtsConfigId"
          class="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-full"
          title="选择用于生成的 TTS 服务"
        >
          <option value="" disabled>-- 选择 TTS 模型 --</option>
          <option v-for="conf in ttsConfigs" :key="conf.id" :value="conf.id">{{ conf.name }}</option>
        </select>

        <div class="flex flex-wrap gap-2">
          <button
            :disabled="isSequencePlaying"
            :class="['flex-1 px-2 py-2 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center', isGeneratingAll ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700 disabled:opacity-50']"
            @click="generateAllLines"
          >
            <span v-if="isGeneratingAll" class="animate-spin mr-2">...</span>
            {{ generateAllButtonLabel }}
          </button>
          <button
            :disabled="isSequencePlaying || isGeneratingAll"
            class="px-2 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center"
            @click="clearAllGeneratedAudio"
          >
            清空配音
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="!isSequencePlaying"
            class="flex-1 px-2 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
            @click="playScriptSequentially"
          >
            {{ sequencePlaybackLabel }}
          </button>
          <button
            v-else
            class="flex-1 px-2 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all"
            @click="stopScriptSequentially"
          >
            停止播放
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
