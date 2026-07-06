<script setup lang="ts">
/**
 * @fileoverview BGM 控制行
 * @description 编辑脚本中的 BGM 播放/停止控制块
 * @module src/components/workbench/script/BgmLineBlock
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
  bgmLibrary,
  removeScriptLine
} = useWorkbenchContext()
</script>

<template>
  <div
    :class="['flex flex-wrap items-center gap-3 p-3 rounded-lg border mb-2 transition-all', selectedLineIndex === index ? 'border-purple-500 bg-purple-50 shadow-md' : 'bg-purple-50/50 border-purple-200', currentSequenceIndex === index ? 'ring-2 ring-green-500' : '']"
  >
    <div class="flex flex-col items-center justify-center gap-1 w-8 flex-shrink-0 border-r border-purple-200 pr-2">
      <button class="text-purple-400 hover:text-purple-700 p-0.5 hover:bg-purple-100 rounded" title="上移" @click.stop="moveLineUp(index)">▲</button>
      <div class="text-xs font-bold text-purple-500 select-none">{{ index + 1 }}</div>
      <button class="text-purple-400 hover:text-purple-700 p-0.5 hover:bg-purple-100 rounded" title="下移" @click.stop="moveLineDown(index)">▼</button>
    </div>
    <div class="w-24 flex-shrink-0 font-bold text-xs text-purple-600 uppercase tracking-wider flex items-center justify-center border-r border-purple-200 pr-3">BGM 控制</div>
    <select
      v-model="line.action"
      class="w-24 px-2 py-1.5 text-xs border rounded bg-white focus:ring-1 focus:ring-purple-500 outline-none font-bold text-purple-700"
    >
      <option value="play">播放</option>
      <option value="stop">停止</option>
    </select>
    <div class="flex-1 min-w-[220px] flex items-center gap-2">
      <select
        v-if="line.action === 'play'"
        v-model="line.bgmName"
        class="flex-1 px-2 py-1.5 text-xs border rounded bg-white focus:ring-1 focus:ring-purple-500 outline-none font-bold text-purple-700"
      >
        <option value="" disabled>-- 选择背景音乐 --</option>
        <option v-for="bgm in bgmLibrary" :key="bgm.id" :value="bgm.name">{{ bgm.name }}</option>
      </select>
      <div v-else class="flex-1 text-xs text-slate-400 italic py-1.5 px-2">停止当前播放的所有背景音乐</div>
    </div>
    <div v-if="line.action === 'play'" class="w-28 flex-shrink-0 space-y-1">
      <div class="text-[10px] font-bold text-slate-400 uppercase text-center leading-tight">BGM音量</div>
      <input
        v-model="line.volume"
        type="range"
        min="0"
        max="2"
        step="0.05"
        class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
      />
    </div>
    <button class="text-slate-300 hover:text-red-500 p-2" @click="removeScriptLine(index)">
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </div>
</template>
