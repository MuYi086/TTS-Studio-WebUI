<script setup lang="ts">
/**
 * @fileoverview 背景图片控制行
 * @description 编辑 bgImage 块的图片资产与图片生成提示词
 * @module src/components/workbench/script/BgImageLineBlock
 */
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'

const { line, index } = defineProps<{
  line: any
  index: number
}>()

const {
  selectedLineIndex,
  currentSequenceIndex,
  moveLineUp,
  moveLineDown,
  removeScriptLine,
  openImagePreview,
  openBgImagePicker,
  copyBgImagePrompt
} = useWorkbenchContext()
</script>

<template>
  <div
    :class="['flex flex-col gap-2 p-3 rounded-lg mb-2 transition-all group cursor-pointer border', selectedLineIndex === index ? 'bg-emerald-50 border-emerald-300 shadow-md' : 'bg-emerald-50/50 border-emerald-200', currentSequenceIndex === index ? 'ring-2 ring-green-500' : '']"
  >
    <div class="flex flex-wrap items-start gap-3">
      <div class="flex flex-col items-center justify-center gap-1 w-8 flex-shrink-0 border-r border-emerald-200 pr-2">
        <button class="text-emerald-400 hover:text-emerald-700 p-0.5 hover:bg-emerald-100 rounded" title="上移" @click.stop="moveLineUp(index)">▲</button>
        <div class="text-xs font-bold text-emerald-500 select-none">{{ index + 1 }}</div>
        <button class="text-emerald-400 hover:text-emerald-700 p-0.5 hover:bg-emerald-100 rounded" title="下移" @click.stop="moveLineDown(index)">▼</button>
      </div>

      <div class="flex-1 min-w-[260px]">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="font-bold text-xs text-emerald-700 uppercase tracking-wider">背景图片块</div>
          <button class="text-slate-300 hover:text-red-500 p-2" title="删除" @click="removeScriptLine(index)">
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3">
          <div class="space-y-2">
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">图片预览</div>
            <div class="w-full bg-white border border-emerald-200 rounded-lg overflow-hidden">
              <img
                v-if="line.imageUrl"
                :src="line.imageUrl"
                class="w-full h-[90px] object-cover bg-white cursor-zoom-in"
                @click.stop="openImagePreview(line.imageUrl)"
              />
              <div
                v-else
                class="w-full h-[90px] flex items-center justify-center bg-white/50 border-dashed text-[10px] text-emerald-600 border border-emerald-200"
              >
                未选择
              </div>
            </div>
            <button
              type="button"
              class="w-full px-2 py-1.5 bg-emerald-100 text-emerald-700 text-[11px] border border-emerald-200 rounded hover:bg-emerald-200 transition-all font-bold"
              @click.stop="openBgImagePicker(index)"
            >
              选择图片（保存）
            </button>
          </div>

          <div class="space-y-2 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">LLM 图片提示词（中文）</div>
              <button
                type="button"
                class="px-2 py-1 bg-white text-emerald-700 text-[11px] border border-emerald-200 rounded hover:bg-emerald-50 transition-all font-bold"
                @click.stop="copyBgImagePrompt(line)"
              >
                复制
              </button>
            </div>
            <textarea
              v-model="line.bgImagePrompt"
              rows="3"
              class="w-full bg-white border border-emerald-200 rounded px-2 py-1.5 text-[11px] text-emerald-900 focus:ring-0 outline-none resize-none"
              placeholder="由 AI 分析后生成的中文图片提示词"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
