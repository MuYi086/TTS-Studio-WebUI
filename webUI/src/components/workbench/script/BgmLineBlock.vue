<script setup lang="ts">
/**
 * @fileoverview BGM 控制行
 * @description 编辑脚本中的 BGM 播放/停止控制块
 * @module src/components/workbench/script/BgmLineBlock
 */
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'
import type { BgmLine } from '../../../types/workbench'

const { line, index } = defineProps<{
  line: BgmLine
  index: number
}>()

const {
  selectedLineIndex,
  currentSequenceIndex,
  moveLineUp,
  moveLineDown,
  bgmLibrary,
  removeScriptLine
} = useWorkbenchContext()
</script>

<template>
  <div
    :class="['flex flex-wrap items-center gap-3 p-3 rounded-lg border mb-2 transition-all', selectedLineIndex === index ? 'border-purple-500 bg-purple-50 shadow-md' : 'bg-purple-50/50 border-purple-200', currentSequenceIndex === index ? 'ring-2 ring-green-500' : '']"
  >
    <div class="flex flex-col items-center justify-center gap-1 w-8 flex-shrink-0 border-r border-purple-200 pr-2">
      <el-button link type="primary" size="small" title="上移" @click.stop="moveLineUp(index)">
        <el-icon><ArrowUp /></el-icon>
      </el-button>
      <div class="text-xs font-bold text-purple-500 select-none">{{ index + 1 }}</div>
      <el-button link type="primary" size="small" title="下移" @click.stop="moveLineDown(index)">
        <el-icon><ArrowDown /></el-icon>
      </el-button>
    </div>
    <div class="w-24 flex-shrink-0 font-bold text-xs text-purple-600 uppercase tracking-wider flex items-center justify-center border-r border-purple-200 pr-3">BGM 控制</div>
    <el-select
      v-model="line.action"
      size="small"
      class="w-24"
    >
      <el-option label="播放" value="play" />
      <el-option label="停止" value="stop" />
    </el-select>
    <div class="flex-1 min-w-[220px] flex items-center gap-2">
      <el-select
        v-if="line.action === 'play'"
        v-model="line.bgmName"
        size="small"
        filterable
        placeholder="选择背景音乐"
        class="flex-1"
      >
        <el-option v-for="bgm in bgmLibrary" :key="bgm.id" :label="bgm.name" :value="bgm.name" />
      </el-select>
      <div v-else class="flex-1 text-xs text-slate-400 italic py-1.5 px-2">停止当前播放的所有背景音乐</div>
    </div>
    <div v-if="line.action === 'play'" class="w-28 flex-shrink-0 space-y-1">
      <div class="text-[10px] font-bold text-slate-400 uppercase text-center leading-tight">BGM音量</div>
      <el-slider v-model="line.volume" :min="0" :max="2" :step="0.05" />
    </div>
    <el-button type="danger" link @click="removeScriptLine(index)">
      <el-icon><Delete /></el-icon>
    </el-button>
  </div>
</template>
