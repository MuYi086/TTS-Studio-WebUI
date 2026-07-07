<script setup lang="ts">
/**
 * @fileoverview 对白台词行
 * @description 编辑单条对白的角色、情绪、滤镜、音频生成、裁剪和行内音效
 * @module src/components/workbench/script/DialogueLineBlock
 */
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'
import type { DialogueLine } from '../../../types/workbench'

const { line, index } = defineProps<{
  line: DialogueLine
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
        <el-button link type="primary" size="small" title="上移" @click.stop="moveLineUp(index)">
          <el-icon><ArrowUp /></el-icon>
        </el-button>
        <div class="text-xs font-bold text-slate-400 select-none">{{ index + 1 }}</div>
        <el-button link type="primary" size="small" title="下移" @click.stop="moveLineDown(index)">
          <el-icon><ArrowDown /></el-icon>
        </el-button>
      </div>

      <div class="w-24 flex-shrink-0 flex flex-col justify-center gap-1">
        <el-select
          v-model="line.role"
          size="small"
          filterable
          class="w-full"
        >
          <el-option v-for="roleName in availableRoles" :key="roleName" :label="roleName" :value="roleName" />
        </el-select>
        <el-select
          v-model="line.filter"
          size="small"
          clearable
          class="w-full"
          title="音频滤波器"
        >
          <el-option label="无滤波器" value="" />
          <el-option v-for="filter in filterLibrary" :key="filter.id" :label="filter.name" :value="filter.name" />
        </el-select>
      </div>

      <div class="w-36 flex-shrink-0 space-y-1 flex flex-col justify-center">
        <el-select
          v-model="line.emotion"
          size="small"
          filterable
          placeholder="选择情绪"
          class="w-full"
        >
          <el-option v-for="preset in emotionPresets" :key="preset.id" :label="preset.name" :value="preset.name" />
        </el-select>
        <el-select
          v-if="isSystemEmotion(line.emotion)"
          v-model="line.intensity"
          size="small"
          class="w-full"
        >
          <el-option label="微弱 (0.2)" value="微弱" />
          <el-option label="稍弱 (0.35)" value="稍弱" />
          <el-option label="中等 (0.5)" value="中等" />
          <el-option label="较强 (0.75)" value="较强" />
          <el-option label="强烈 (1.0)" value="强烈" />
        </el-select>
      </div>

      <div class="w-16 flex-shrink-0 space-y-1 flex flex-col justify-center">
        <div class="text-[10px] font-bold text-slate-400 uppercase text-center leading-tight">停顿(s)</div>
        <el-input-number
          v-model="line.break_duration"
          :step="0.1"
          :min="0"
          :controls="false"
          size="small"
          class="w-full"
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
              <el-slider v-model="line.dialogueVolume" :min="0" :max="2" :step="0.05" />
            </div>
            <div class="w-full">
              <div class="flex justify-between items-center mb-0.5">
                <span class="text-[8px] font-bold text-slate-400 uppercase">音效音量</span>
                <span class="text-[8px] text-slate-400 font-mono">{{ Math.round((line.sfxVolume || 0.5) * 100) }}%</span>
              </div>
              <el-slider v-model="line.sfxVolume" :min="0" :max="2" :step="0.05" />
            </div>
            <div class="w-full">
              <div class="flex justify-between items-center mb-0.5">
                <span class="text-[8px] font-bold text-slate-400 uppercase">语速</span>
                <span class="text-[8px] text-slate-400 font-mono">{{ (line.speed || 1).toFixed(1) }}x</span>
              </div>
              <el-slider v-model="line.speed" :min="0.5" :max="2" :step="0.1" />
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
            <el-button
              :title="line.isGenerating ? '停止生成' : '生成音频'"
              :type="line.isGenerating ? 'danger' : 'primary'"
              link
              @click.stop="generateLineAudio(line)"
            >
              <el-icon><Lightning /></el-icon>
            </el-button>
            <el-button
              v-if="line.audioUrl"
              :type="isAuditioningId === line.id ? 'success' : 'info'"
              link
              title="播放"
              @click.stop="playLineAudio(line)"
            >
              <el-icon><VideoPlay /></el-icon>
            </el-button>
            <el-button v-if="line.audioUrl" type="danger" link title="清除音频" @click.stop="clearLineAudio(line)">
              <el-icon><Delete /></el-icon>
            </el-button>
            <el-button class="opacity-0 group-hover:opacity-100 transition-opacity" type="danger" link title="删除" @click="removeScriptLine(index)">
              <el-icon><CircleClose /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 w-full">
        <el-tag
          v-for="(sfx, sfxIndex) in line.sfx"
          :key="sfxIndex"
          type="primary"
          effect="plain"
          class="sfx-inline-tag"
        >
          <el-select
            v-model="sfx.name"
            size="small"
            filterable
            class="w-[120px]"
          >
            <el-option v-for="librarySfx in sfxLibrary" :key="librarySfx.id" :label="librarySfx.name" :value="librarySfx.name" />
          </el-select>
          <span class="mx-1 text-slate-400">@</span>
          <el-input-number
            v-model="sfx.position"
            :step="0.1"
            :min="0"
            :max="1"
            :controls="false"
            size="small"
            class="w-[54px]"
            title="插入位置 (0.0 - 1.0)"
          />
          <el-button type="danger" link size="small" @click="removeLineSfx(line, sfxIndex)">
            <el-icon><Close /></el-icon>
          </el-button>
        </el-tag>
        <el-button
          size="small"
          type="primary"
          plain
          @click="addLineSfx(line)"
        >
          <el-icon><Plus /></el-icon>
          + 音效
        </el-button>
      </div>

      <div class="w-full flex flex-col gap-2 min-w-0">
        <el-input
          v-model="line.text"
          type="textarea"
          :autosize="{ minRows: 2 }"
          resize="vertical"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sfx-inline-tag {
  height: auto;
  padding: 4px 6px;
}
</style>
