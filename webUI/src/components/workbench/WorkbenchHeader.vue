<script setup lang="ts">
/**
 * @fileoverview 工作台头部与全局工具栏
 * @description 负责展示品牌信息、标签切换与导入导出动作
 * - 标签页：切换配置、资源、脚本与 Prompt 管理区域
 * - 工具栏：导入导出工程、字幕、音频与视频
 * - 文件入口：承接隐藏文件选择框
 * @module src/components/workbench/WorkbenchHeader
 */
import { useWorkbenchContext } from '../../composables/useWorkbenchContext'

const {
  activeTab,
  exportScriptState,
  isExportingProject,
  exportStatus,
  triggerImport,
  triggerImportTxt,
  exportSRT,
  isExportingAudio,
  exportAudio,
  videoResolution,
  generateVideo,
  isSequencePlaying,
  isGeneratingVideo,
  importFileRef,
  handleImportFile,
  importTxtRef,
  handleImportTxt,
  bgImagePickerRef,
  handleBgImageFileChange
} = useWorkbenchContext()
</script>

<template>
  <header class="mb-6 flex justify-between items-end">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Unitale AI <span class="text-blue-600">1.5</span></h1>
      <p style="color: rgb(39, 92, 120);" class="text-slate-400 text-xs mt-1">多角色音效合成有声书生成工具</p>
    </div>
    <div class="text-[10px] text-slate-300">v1.5</div>
  </header>

  <div class="flex flex-wrap items-center justify-between border-b border-slate-200 mb-6 gap-4">
    <div class="flex overflow-x-auto">
      <button
        @click="activeTab = 'config'"
        :class="['px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap', activeTab === 'config' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700']"
      >
        模型配置
      </button>
      <button
        @click="activeTab = 'timbres'"
        :class="['px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap', activeTab === 'timbres' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700']"
      >
        音色资源库
      </button>
      <button
        @click="activeTab = 'sfx'"
        :class="['px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap', activeTab === 'sfx' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700']"
      >
        音效与滤波器
      </button>
      <button
        @click="activeTab = 'script'"
        :class="['px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap', activeTab === 'script' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700']"
      >
        脚本制作
      </button>
      <button
        @click="activeTab = 'prompt'"
        :class="['px-6 py-3 text-sm font-bold transition-colors whitespace-nowrap', activeTab === 'prompt' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700']"
      >
        Prompt 管理
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2 py-2">
      <button
        @click="exportScriptState"
        :disabled="isExportingProject"
        class="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-wait"
      >
        {{ isExportingProject ? exportStatus : '导出完整工程' }}
      </button>
      <button
        @click="triggerImport"
        :disabled="isExportingProject"
        class="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-all flex items-center gap-1 disabled:opacity-50"
      >
        {{ isExportingProject ? '请等待...' : '导入完整工程' }}
      </button>
      <button
        @click="triggerImportTxt"
        :disabled="isExportingProject"
        class="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-1 disabled:opacity-50"
      >
        导入TXT
      </button>
      <button
        @click="exportSRT"
        :disabled="isExportingAudio"
        class="px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-xs font-bold hover:bg-teal-200 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-wait"
      >
        导出SRT字幕
      </button>
      <button
        @click="exportAudio"
        :disabled="isExportingAudio"
        class="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-wait"
      >
        {{ isExportingAudio ? (exportStatus || '⏳ 处理中...') : '导出音频' }}
      </button>
      <select
        v-model="videoResolution"
        class="px-2 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
      >
        <option value="1920x1080">横屏 16:9</option>
        <option value="1080x1920">竖屏 9:16</option>
        <option value="1280x960">横屏 4:3</option>
        <option value="960x1280">竖屏 3:4</option>
      </select>
      <button
        @click="generateVideo"
        :disabled="isExportingAudio || isSequencePlaying || isGeneratingVideo"
        class="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-xs font-bold hover:bg-sky-200 transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-wait"
      >
        {{ isGeneratingVideo ? (exportStatus || '⏳ 生成视频...') : '生成视频' }}
      </button>
      <input type="file" ref="importFileRef" @change="handleImportFile" accept=".json" class="hidden" />
      <input type="file" ref="importTxtRef" @change="handleImportTxt" accept=".txt" class="hidden" />
      <input type="file" ref="bgImagePickerRef" @change="handleBgImageFileChange" accept="image/*" class="hidden" />
    </div>
  </div>
</template>
