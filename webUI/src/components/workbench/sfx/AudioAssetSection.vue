<script setup lang="ts">
/**
 * @fileoverview 音频素材资源区块
 * @description 复用音效与 BGM 的表单、裁剪预览、列表维护交互
 * @module src/components/workbench/sfx/AudioAssetSection
 */
import { computed, useTemplateRef } from 'vue'
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'

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
const assetForm = computed<any>(() => (props.kind === 'sfx' ? sfxForm.value : bgmForm.value))
const assetLibrary = computed<any[]>(() => (props.kind === 'sfx' ? sfxLibrary.value : bgmLibrary.value))

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

const editAsset = (asset: any): void => {
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
    <h2 class="text-lg font-bold text-slate-800 border-b pb-2">{{ sectionTitle }}</h2>
    <p v-if="kind === 'sfx'">
      音效和背景音乐可以自行使用其他的AI模型生成，或者前往在线免费音效网站下载：
      <a :href="pixabaySoundEffectsUrl" style="color: blue;" target="_blank" rel="noreferrer">Pixabay在线音效库</a>
    </p>

    <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
      <h3 class="text-sm font-bold text-slate-700 mb-4">{{ formHeading }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">{{ nameLabel }}</label>
          <input
            v-model="assetForm.name"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            :placeholder="namePlaceholder"
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">{{ descriptionLabel }}</label>
          <input
            v-model="assetForm.description"
            class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            :placeholder="descriptionPlaceholder"
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">音频文件名 / 路径</label>
          <div class="flex gap-2 items-center">
            <input ref="fileInput" type="file" accept=".wav,.mp3" class="hidden" @change="handleFileUpload" />
            <button
              type="button"
              class="whitespace-nowrap px-3 py-2 bg-slate-100 border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-200 transition-colors"
              @click="openFileDialog"
            >
              选择文件
            </button>
            <input
              v-model="assetForm.filename"
              class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              :placeholder="filePlaceholder"
            />
          </div>
          <p class="text-[10px] text-slate-400 mt-1"></p>
        </div>
        <div class="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
          <div class="flex items-center gap-4 mb-4">
            <span class="text-[10px] font-bold text-slate-500 uppercase w-16">默认音量</span>
            <input
              v-model.number="assetForm.volume"
              type="range"
              min="0"
              max="2"
              step="0.05"
              class="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span class="text-xs text-slate-500 font-mono w-10 text-right">{{ Math.round((assetForm.volume ?? 1) * 100) }}%</span>
            <button
              type="button"
              :disabled="!assetForm.filename"
              class="text-xs text-slate-400 hover:text-green-600 ml-2 disabled:opacity-30 disabled:cursor-not-allowed"
              title="试听"
              @click="playPreview(assetForm)"
            >
              <svg
                v-if="previewPlayingFile === assetForm.filename"
                class="h-5 w-5 text-green-600"
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
              <svg v-else class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div v-if="assetForm.filename">
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
        </div>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
          @click.prevent="saveAsset"
        >
          {{ saveLabel }}
        </button>
        <button
          v-if="isEditing"
          type="button"
          class="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-all"
          @click="resetAssetForm"
        >
          取消
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
      <div
        v-for="asset in assetLibrary"
        :key="asset.id"
        class="bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow flex flex-col"
      >
        <div class="flex items-start justify-between p-4">
          <div class="flex items-start gap-3">
            <input
              v-model="asset.enabled"
              type="checkbox"
              class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer mt-1 flex-shrink-0"
              title="启用/禁用此资源"
            />
            <div>
              <div class="font-bold text-slate-800 text-sm">{{ asset.name }}</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ asset.description }}</div>
              <div class="text-xs text-slate-400 mt-1">{{ asset.filename }}</div>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0 ml-2">
            <button class="text-xs text-slate-400 hover:text-green-600 mr-1" title="试听" @click="playPreview(asset)">
              <svg
                v-if="previewPlayingFile === asset.filename"
                class="h-4 w-4 text-green-600"
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
            <button class="text-xs text-blue-600 hover:underline font-medium" @click="editAsset(asset)">编辑</button>
            <button class="text-xs text-red-500 hover:underline font-medium" @click="deleteAsset(asset.id)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="assetLibrary.length === 0" class="col-span-full text-center py-8 text-slate-400 text-sm">{{ emptyLabel }}</div>
    </div>
  </section>
</template>
