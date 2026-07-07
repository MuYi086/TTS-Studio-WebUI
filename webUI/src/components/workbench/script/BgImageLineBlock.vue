<script setup lang="ts">
/**
 * @fileoverview 背景图片控制行
 * @description 编辑 bgImage 块的图片资产与图片生成提示词
 * @module src/components/workbench/script/BgImageLineBlock
 */
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'
import type { BgImageLine } from '../../../types/workbench'

const { line, index } = defineProps<{
  line: BgImageLine
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
        <el-button link type="success" size="small" title="上移" @click.stop="moveLineUp(index)">
          <el-icon><ArrowUp /></el-icon>
        </el-button>
        <div class="text-xs font-bold text-emerald-500 select-none">{{ index + 1 }}</div>
        <el-button link type="success" size="small" title="下移" @click.stop="moveLineDown(index)">
          <el-icon><ArrowDown /></el-icon>
        </el-button>
      </div>

      <div class="flex-1 min-w-[260px]">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="font-bold text-xs text-emerald-700 uppercase tracking-wider">背景图片块</div>
          <el-button type="danger" link title="删除" @click="removeScriptLine(index)">
            <el-icon><Delete /></el-icon>
          </el-button>
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
            <el-button
              type="success"
              plain
              class="w-full"
              @click.stop="openBgImagePicker(index)"
            >
              <el-icon><Picture /></el-icon>
              选择图片（保存）
            </el-button>
          </div>

          <div class="space-y-2 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">LLM 图片提示词（中文）</div>
              <el-button
                type="success"
                link
                @click.stop="copyBgImagePrompt(line)"
              >
                复制
              </el-button>
            </div>
            <el-input
              v-model="line.bgImagePrompt"
              type="textarea"
              :rows="3"
              resize="vertical"
              placeholder="由 AI 分析后生成的中文图片提示词"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
