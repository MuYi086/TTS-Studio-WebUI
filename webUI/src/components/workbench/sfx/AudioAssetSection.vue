<script setup lang="ts">
/**
 * @fileoverview 音频素材资源区块
 * @description 使用 Element Plus 复用音效与 BGM 的表单、裁剪预览和列表维护交互
 * @module src/components/workbench/sfx/AudioAssetSection
 */
import { computed, useTemplateRef } from 'vue'
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'
import type { AudioAsset } from '../../../types/workbench'

const props = defineProps<{
  kind: 'sfx' | 'bgm'
}>()

const {
  isEditingSfx,
  sfxForm,
  handleSfxFileUpload,
  playPreview,
  previewPlayingFile,
  drawWaveform,
  startDragTrim,
  playbackProgress,
  saveSfx,
  resetSfxForm,
  sfxLibrary,
  editSfx,
  deleteSfx,
  isEditingBgm,
  bgmForm,
  handleBgmFileUpload,
  saveBgm,
  resetBgmForm,
  bgmLibrary,
  editBgm,
  deleteBgm
} = useWorkbenchContext()

const pixabaySoundEffectsUrl = 'https://pixabay.com/zh/sound-effects'
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const sectionTitle = computed(() => (props.kind === 'sfx' ? '音效素材管理' : '背景音乐管理 (BGM)'))
const formHeading = computed(() => {
  if (props.kind === 'sfx') return isEditingSfx.value ? '编辑音效' : '添加新音效'
  return isEditingBgm.value ? '编辑 BGM' : '添加新 BGM'
})
const nameLabel = computed(() => (props.kind === 'sfx' ? '音效名称' : 'BGM 名称'))
const descriptionLabel = computed(() => (props.kind === 'sfx' ? '音效描述 (用于 AI 判断插入)' : 'BGM 描述 (用于 AI 判断)'))
const namePlaceholder = computed(() => (props.kind === 'sfx' ? '例如: 开门声 / 雷声' : '例如: 悲伤钢琴 / 战斗激昂'))
const descriptionPlaceholder = computed(() => (props.kind === 'sfx' ? '例如: 沉重的木门被用力关上' : '例如: 适合悲伤场景的钢琴曲'))
const filePlaceholder = computed(() => (props.kind === 'sfx' ? '例如: door_slam.wav' : '例如: sad_piano.mp3'))
const saveLabel = computed(() => (props.kind === 'sfx' ? '保存音效' : '保存 BGM'))
const emptyLabel = computed(() => (props.kind === 'sfx' ? '暂无音效素材' : '暂无 BGM 素材'))
const isEditing = computed(() => (props.kind === 'sfx' ? isEditingSfx.value : isEditingBgm.value))
const assetForm = computed<AudioAsset>(() => (props.kind === 'sfx' ? sfxForm.value : bgmForm.value))
const assetLibrary = computed<AudioAsset[]>(() => (props.kind === 'sfx' ? sfxLibrary.value : bgmLibrary.value))

const openFileDialog = (): void => {
  fileInput.value?.click()
}

const handleFileUpload = (event: Event): void => {
  if (props.kind === 'sfx') {
    handleSfxFileUpload(event)
    return
  }

  handleBgmFileUpload(event)
}

const saveAsset = (): void => {
  if (props.kind === 'sfx') {
    saveSfx()
    return
  }

  saveBgm()
}

const resetAssetForm = (): void => {
  if (props.kind === 'sfx') {
    resetSfxForm()
    return
  }

  resetBgmForm()
}

const editAsset = (asset: AudioAsset): void => {
  if (props.kind === 'sfx') {
    editSfx(asset)
    return
  }

  editBgm(asset)
}

const deleteAsset = (id: string): void => {
  if (props.kind === 'sfx') {
    deleteSfx(id)
    return
  }

  deleteBgm(id)
}
</script>

<template>
  <section class="space-y-6" :class="{ 'border-t border-slate-200 pt-6': kind === 'bgm' }">
    <div>
      <h2 class="text-lg font-bold text-slate-800 border-b pb-2">{{ sectionTitle }}</h2>
      <p v-if="kind === 'sfx'" class="text-sm text-slate-500 mt-3">
        音效和背景音乐可以自行使用其他的AI模型生成，或者前往在线免费音效网站下载：
        <el-link :href="pixabaySoundEffectsUrl" type="primary" target="_blank" rel="noreferrer">Pixabay在线音效库</el-link>
      </p>
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="font-bold text-slate-700">{{ formHeading }}</div>
      </template>

      <el-form :model="assetForm" label-position="top">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item :label="nameLabel">
              <el-input v-model="assetForm.name" clearable :placeholder="namePlaceholder" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="descriptionLabel">
              <el-input v-model="assetForm.description" clearable :placeholder="descriptionPlaceholder" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="音频文件名 / 路径">
              <el-input v-model="assetForm.filename" clearable :placeholder="filePlaceholder">
                <template #prepend>
                  <el-button @click="openFileDialog">
                    <el-icon><FolderOpened /></el-icon>
                    <span>选择文件</span>
                  </el-button>
                </template>
              </el-input>
              <input ref="fileInput" type="file" accept=".wav,.mp3" class="hidden" @change="handleFileUpload" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="默认音量">
              <div class="flex items-center gap-4 w-full">
                <el-slider v-model="assetForm.volume" :min="0" :max="2" :step="0.05" class="flex-1" />
                <span class="text-xs text-slate-500 font-mono w-12 text-right">{{ Math.round((assetForm.volume ?? 1) * 100) }}%</span>
                <el-button
                  :disabled="!assetForm.filename"
                  :type="previewPlayingFile === assetForm.filename ? 'success' : 'info'"
                  plain
                  @click="playPreview(assetForm)"
                >
                  {{ previewPlayingFile === assetForm.filename ? '停止' : '试听' }}
                </el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <div v-if="assetForm.filename" class="mb-4">
          <div class="flex justify-between items-center px-0.5 mb-1">
            <span class="text-[10px] font-bold text-slate-500 uppercase">音频剪辑 (预览)</span>
            <span class="text-[10px] text-slate-400 font-mono">{{ Math.round(((assetForm.trimEnd ?? 1) - (assetForm.trimStart ?? 0)) * 100) }}%</span>
          </div>
          <div :key="assetForm.filename" class="relative w-full bg-slate-100 rounded border border-slate-200 overflow-hidden select-none group/wave" style="height: 40px;">
            <canvas :ref="(el) => drawWaveform(el, assetForm)" width="300" height="40" class="w-full h-full block opacity-60"></canvas>
            <div class="absolute inset-0 pointer-events-none">
              <div class="absolute top-0 bottom-0 left-0 bg-slate-500/30 border-r border-blue-500" :style="{ width: (assetForm.trimStart ?? 0) * 100 + '%' }"></div>
              <div class="absolute top-0 bottom-0 right-0 bg-slate-500/30 border-l border-red-500" :style="{ width: (1 - (assetForm.trimEnd ?? 1)) * 100 + '%' }"></div>
              <div
                class="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize pointer-events-auto hover:bg-blue-500/10 transition-colors flex justify-center group/handle"
                :style="{ left: (assetForm.trimStart ?? 0) * 100 + '%' }"
                @mousedown.stop="startDragTrim($event, assetForm, 'start')"
              >
                <div class="w-0.5 h-full bg-blue-500 group-hover/handle:w-1 transition-all"></div>
              </div>
              <div
                class="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize pointer-events-auto hover:bg-red-500/10 transition-colors flex justify-center group/handle"
                :style="{ left: (assetForm.trimEnd ?? 1) * 100 + '%' }"
                @mousedown.stop="startDragTrim($event, assetForm, 'end')"
              >
                <div class="w-0.5 h-full bg-red-500 group-hover/handle:w-1 transition-all"></div>
              </div>
              <div
                v-if="previewPlayingFile === assetForm.filename"
                class="absolute top-0 bottom-0 w-0.5 bg-green-500 z-20 pointer-events-none shadow-[0_0_4px_rgba(34,197,94,0.8)]"
                :style="{ left: (playbackProgress * 100) + '%' }"
              ></div>
            </div>
          </div>
          <div class="text-[10px] text-slate-400 mt-1 text-right">提示：拖动红蓝线条裁剪音频，点击保存后生效</div>
        </div>

        <el-space>
          <el-button type="primary" @click.prevent="saveAsset">
            <el-icon><Check /></el-icon>
            <span>{{ saveLabel }}</span>
          </el-button>
          <el-button v-if="isEditing" @click="resetAssetForm">
            <el-icon><Close /></el-icon>
            <span>取消</span>
          </el-button>
        </el-space>
      </el-form>
    </el-card>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
      <el-card v-for="asset in assetLibrary" :key="asset.id" shadow="hover">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3 min-w-0">
            <el-checkbox v-model="asset.enabled" title="启用/禁用此资源" />
            <div class="min-w-0">
              <div class="font-bold text-slate-800 text-sm">{{ asset.name }}</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ asset.description }}</div>
              <div class="text-xs text-slate-400 mt-1 break-all">{{ asset.filename }}</div>
            </div>
          </div>
          <el-space>
            <el-button :type="previewPlayingFile === asset.filename ? 'success' : 'info'" link @click="playPreview(asset)">
              {{ previewPlayingFile === asset.filename ? '停止' : '试听' }}
            </el-button>
            <el-button type="primary" link @click="editAsset(asset)">编辑</el-button>
            <el-button type="danger" link @click="deleteAsset(asset.id)">删除</el-button>
          </el-space>
        </div>
      </el-card>
      <el-empty v-if="assetLibrary.length === 0" class="col-span-full" :description="emptyLabel" />
    </div>
  </section>
</template>
