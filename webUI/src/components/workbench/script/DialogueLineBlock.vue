<script setup lang="ts">
/**
 * @fileoverview 对白台词行
 * @description 编辑单条对白的角色、情绪、滤镜、音频生成、裁剪和行内音效
 * @module src/components/workbench/script/DialogueLineBlock
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
  availableRoles,
  filterLibrary,
  emotionPresets,
  isSystemEmotion,
  generateLineAudio,
  isAuditioningId,
  playLineAudio,
  clearLineAudio,
  playbackProgress,
  drawWaveform,
  startDragTrim,
  removeScriptLine,
  autoResizeTextarea,
  sfxLibrary,
  addLineSfx,
  removeLineSfx
} = useWorkbenchContext()
</script>

<template>
  <div
    :class="['flex flex-col gap-2 p-3 rounded-lg mb-2 transition-all group cursor-pointer border', selectedLineIndex === index ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-white border-slate-200 shadow-sm hover:bg-slate-50', currentSequenceIndex === index ? 'ring-2 ring-green-500' : '']"
  >
    <div class="flex flex-wrap items-stretch gap-3">
      <div class="flex flex-col items-center justify-center gap-1 w-8 flex-shrink-0 border-r border-slate-100 pr-2">
        <button class="text-slate-400 hover:text-blue-600 p-0.5 hover:bg-slate-100 rounded" title="上移" @click.stop="moveLineUp(index)">▲</button>
        <div class="text-xs font-bold text-slate-400 select-none">{{ index + 1 }}</div>
        <button class="text-slate-400 hover:text-blue-600 p-0.5 hover:bg-slate-100 rounded" title="下移" @click.stop="moveLineDown(index)">▼</button>
      </div>

      <div class="w-24 flex-shrink-0 flex flex-col justify-center gap-1">
        <select
          v-model="line.role"
          class="w-full px-2 py-1.5 text-xs border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none font-bold text-slate-700"
        >
          <option v-for="roleName in availableRoles" :key="roleName" :value="roleName">{{ roleName }}</option>
        </select>
        <select
          v-model="line.filter"
          class="w-full px-2 py-1 text-[10px] border rounded bg-slate-50 focus:ring-1 focus:ring-blue-500 outline-none text-slate-500"
          title="音频滤波器"
        >
          <option value="">无滤波器</option>
          <option v-for="filter in filterLibrary" :key="filter.id" :value="filter.name">{{ filter.name }}</option>
        </select>
      </div>

      <div class="w-36 flex-shrink-0 space-y-1 flex flex-col justify-center">
        <select
          v-model="line.emotion"
          class="w-full px-2 py-1.5 text-xs border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 font-bold"
        >
          <option value="" disabled>选择情绪</option>
          <option v-for="preset in emotionPresets" :key="preset.id" :value="preset.name">{{ preset.name }}</option>
        </select>
        <select
          v-if="isSystemEmotion(line.emotion)"
          v-model="line.intensity"
          class="w-full px-2 py-1 text-xs border rounded bg-slate-50 focus:ring-1 focus:ring-blue-500 outline-none text-slate-600"
        >
          <option value="微弱">微弱 (0.2)</option>
          <option value="稍弱">稍弱 (0.35)</option>
          <option value="中等">中等 (0.5)</option>
          <option value="较强">较强 (0.75)</option>
          <option value="强烈">强烈 (1.0)</option>
        </select>
      </div>

      <div class="w-16 flex-shrink-0 space-y-1 flex flex-col justify-center">
        <div class="text-[10px] font-bold text-slate-400 uppercase text-center leading-tight">停顿(s)</div>
        <input
          v-model="line.break_duration"
          type="number"
          step="0.1"
          min="0"
          class="w-full px-1 py-1.5 text-xs border rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none text-center font-mono text-slate-600"
          placeholder="0"
        />
      </div>

      <div class="flex-grow"></div>

      <div class="flex flex-col items-end gap-2">
        <div class="flex items-center gap-3">
          <div v-if="line.audioUrl" class="w-48 flex-shrink-0 flex flex-col justify-center gap-2 px-2 border-r border-slate-200">
            <div class="w-full">
              <div class="flex justify-between items-center mb-0.5">
                <span class="text-[8px] font-bold text-slate-400 uppercase">台词音量</span>
                <span class="text-[8px] text-slate-400 font-mono">{{ Math.round((line.dialogueVolume ?? 1) * 100) }}%</span>
              </div>
              <input
                v-model.number="line.dialogueVolume"
                type="range"
                min="0"
                max="2"
                step="0.05"
                class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 block"
              />
            </div>
            <div class="w-full">
              <div class="flex justify-between items-center mb-0.5">
                <span class="text-[8px] font-bold text-slate-400 uppercase">音效音量</span>
                <span class="text-[8px] text-slate-400 font-mono">{{ Math.round((line.sfxVolume || 0.5) * 100) }}%</span>
              </div>
              <input
                v-model="line.sfxVolume"
                type="range"
                min="0"
                max="2"
                step="0.05"
                class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 block"
              />
            </div>
            <div class="w-full">
              <div class="flex justify-between items-center mb-0.5">
                <span class="text-[8px] font-bold text-slate-400 uppercase">语速</span>
                <span class="text-[8px] text-slate-400 font-mono">{{ (line.speed || 1).toFixed(1) }}x</span>
              </div>
              <input
                v-model.number="line.speed"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600 block"
              />
            </div>
          </div>

          <div v-if="line.audioUrl" class="w-48 flex-shrink-0 flex flex-col gap-1">
            <div class="flex justify-between items-center px-0.5">
              <span class="text-[8px] font-bold text-slate-400 uppercase">音频剪辑</span>
              <span class="text-[8px] text-slate-400 font-mono">{{ Math.round(((line.trimEnd || 1) - (line.trimStart || 0)) * 100) }}%</span>
            </div>
            <div :key="line.audioUrl" class="relative w-full bg-slate-100 rounded border border-slate-200 overflow-hidden select-none group/wave" style="height: 32px;">
              <canvas :ref="(el) => drawWaveform(el, line)" width="192" height="32" class="w-full h-full block opacity-60"></canvas>
              <div class="absolute inset-0 pointer-events-none">
                <div class="absolute top-0 bottom-0 left-0 bg-slate-500/30 border-r border-blue-500" :style="{ width: (line.trimStart || 0) * 100 + '%' }"></div>
                <div class="absolute top-0 bottom-0 right-0 bg-slate-500/30 border-l border-red-500" :style="{ width: (1 - (line.trimEnd || 1)) * 100 + '%' }"></div>
                <div
                  class="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize pointer-events-auto hover:bg-blue-500/10 transition-colors flex justify-center group/handle"
                  :style="{ left: (line.trimStart || 0) * 100 + '%' }"
                  @mousedown.stop="startDragTrim($event, line, 'start')"
                >
                  <div class="w-0.5 h-full bg-blue-500 group-hover/handle:w-1 transition-all"></div>
                </div>
                <div
                  class="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize pointer-events-auto hover:bg-red-500/10 transition-colors flex justify-center group/handle"
                  :style="{ left: (line.trimEnd || 1) * 100 + '%' }"
                  @mousedown.stop="startDragTrim($event, line, 'end')"
                >
                  <div class="w-0.5 h-full bg-red-500 group-hover/handle:w-1 transition-all"></div>
                </div>
                <div
                  v-if="isAuditioningId === line.id"
                  class="absolute top-0 bottom-0 w-0.5 bg-green-500 z-20 pointer-events-none shadow-[0_0_4px_rgba(34,197,94,0.8)]"
                  :style="{ left: (playbackProgress * 100) + '%' }"
                ></div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button
              :title="line.isGenerating ? '停止生成' : '生成音频'"
              :class="['p-2', line.isGenerating ? 'text-red-500 hover:text-red-700' : 'text-slate-400 hover:text-indigo-600 disabled:text-slate-300 disabled:cursor-wait']"
              @click.stop="generateLineAudio(line)"
            >
              <svg v-if="line.isGenerating" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <button v-if="line.audioUrl" class="text-slate-400 hover:text-green-600 p-2" title="播放" @click.stop="playLineAudio(line)">
              <svg
                v-if="isAuditioningId === line.id"
                class="h-4 w-4 animate-pulse text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <svg v-else class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <button v-if="line.audioUrl" class="text-slate-400 hover:text-red-600 p-2" title="清除音频" @click.stop="clearLineAudio(line)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <button class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2" title="删除" @click="removeScriptLine(index)">
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 w-full">
        <div
          v-for="(sfx, sfxIndex) in line.sfx"
          :key="sfxIndex"
          class="flex items-center bg-blue-50 border border-blue-100 rounded px-2 py-1 text-xs"
        >
          <span class="mr-1"></span>
          <select
            v-model="sfx.name"
            class="bg-transparent outline-none border-b border-transparent hover:border-blue-300 text-blue-700 font-medium max-w-[100px] cursor-pointer"
          >
            <option v-for="librarySfx in sfxLibrary" :key="librarySfx.id" :value="librarySfx.name">{{ librarySfx.name }}</option>
          </select>
          <span class="mx-1 text-slate-400">@</span>
          <input
            v-model="sfx.position"
            type="number"
            step="0.1"
            min="0"
            max="1"
            class="w-10 bg-transparent text-center outline-none border-b border-transparent hover:border-blue-300"
            title="插入位置 (0.0 - 1.0)"
          />
          <button class="ml-2 text-slate-400 hover:text-red-500 font-bold" @click="removeLineSfx(line, sfxIndex)">x</button>
        </div>
        <button
          class="text-[10px] text-slate-400 hover:text-blue-600 border border-dashed border-slate-300 rounded px-2 py-1 hover:border-blue-400 transition-colors flex items-center gap-1"
          @click="addLineSfx(line)"
        >
          + 音效
        </button>
      </div>

      <div class="w-full flex flex-col gap-2 min-w-0">
        <textarea
          v-model="line.text"
          rows="2"
          class="w-full h-full bg-transparent border-none focus:ring-0 text-sm text-slate-700 resize-none leading-relaxed py-1.5"
          @input="autoResizeTextarea($event)"
        ></textarea>
      </div>
    </div>
  </div>
</template>
