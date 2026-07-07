<script setup lang="ts">
/**
 * @fileoverview 工作台头部与全局工具栏
 * @description 使用 Element Plus 组织品牌信息、标签切换与导入导出动作
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
      <h1 class="text-2xl font-bold text-slate-800">TTS <span class="text-blue-600">1.5</span></h1>
      <p style="color: rgb(39, 92, 120);" class="text-slate-400 text-xs mt-1">多角色音效合成有声书生成工具</p>
    </div>
    <el-tag size="small" type="info" effect="plain">v1.5</el-tag>
  </header>

  <div class="border-b border-slate-200 mb-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <el-tabs v-model="activeTab" class="workbench-tabs">
        <el-tab-pane label="模型配置" name="config" />
        <el-tab-pane label="音色资源库" name="timbres" />
        <el-tab-pane label="音效与滤波器" name="sfx" />
        <el-tab-pane label="脚本制作" name="script" />
        <el-tab-pane label="Prompt 管理" name="prompt" />
      </el-tabs>

      <el-space wrap class="py-2">
        <el-button
          type="warning"
          plain
          size="small"
          :loading="isExportingProject"
          :disabled="isExportingProject"
          @click="exportScriptState"
        >
          <el-icon><Download /></el-icon>
          <span>{{ isExportingProject ? exportStatus : '导出完整工程' }}</span>
        </el-button>
        <el-button
          type="warning"
          plain
          size="small"
          :disabled="isExportingProject"
          @click="triggerImport"
        >
          <el-icon><Upload /></el-icon>
          <span>{{ isExportingProject ? '请等待...' : '导入完整工程' }}</span>
        </el-button>
        <el-button
          type="info"
          plain
          size="small"
          :disabled="isExportingProject"
          @click="triggerImportTxt"
        >
          <el-icon><DocumentAdd /></el-icon>
          <span>导入TXT</span>
        </el-button>
        <el-button
          type="success"
          plain
          size="small"
          :loading="isExportingAudio"
          :disabled="isExportingAudio"
          @click="exportSRT"
        >
          <el-icon><Tickets /></el-icon>
          <span>导出SRT字幕</span>
        </el-button>
        <el-button
          type="primary"
          plain
          size="small"
          :loading="isExportingAudio"
          :disabled="isExportingAudio"
          @click="exportAudio"
        >
          <el-icon><Headset /></el-icon>
          <span>{{ isExportingAudio ? (exportStatus || '处理中...') : '导出音频' }}</span>
        </el-button>
        <el-select v-model="videoResolution" size="small" class="w-[120px]" aria-label="视频比例">
          <el-option label="横屏 16:9" value="1920x1080" />
          <el-option label="竖屏 9:16" value="1080x1920" />
          <el-option label="横屏 4:3" value="1280x960" />
          <el-option label="竖屏 3:4" value="960x1280" />
        </el-select>
        <el-button
          type="primary"
          plain
          size="small"
          :loading="isGeneratingVideo"
          :disabled="isExportingAudio || isSequencePlaying || isGeneratingVideo"
          @click="generateVideo"
        >
          <el-icon><VideoCamera /></el-icon>
          <span>{{ isGeneratingVideo ? (exportStatus || '生成视频...') : '生成视频' }}</span>
        </el-button>
      </el-space>
    </div>

    <input type="file" ref="importFileRef" @change="handleImportFile" accept=".json" class="hidden" />
    <input type="file" ref="importTxtRef" @change="handleImportTxt" accept=".txt" class="hidden" />
    <input type="file" ref="bgImagePickerRef" @change="handleBgImageFileChange" accept="image/*" class="hidden" />
  </div>
</template>

<style scoped>
.workbench-tabs {
  min-width: min(100%, 520px);
}
</style>
