<script setup lang="ts">
/**
 * @fileoverview 音色与情绪资源标签页
 * @description 负责维护音色资源和情绪描述预设
 * - 音色管理：新增、编辑、删除、试听本地音色样本
 * - 情绪管理：维护可编辑的情绪预设与 8 维向量
 * - 模板整理：将表单交互与列表展示聚合在单一标签页内
 * @module src/components/workbench/TimbresTab
 */
import { computed, useTemplateRef } from 'vue'
import { useWorkbenchContext } from '../../composables/useWorkbenchContext'

const {
  isEditingTimbre,
  timbreForm,
  handleTimbreFileUpload,
  saveTimbre,
  resetTimbreForm,
  timbres,
  playPreview,
  previewPlayingFile,
  editTimbre,
  deleteTimbre,
  isEditingEmotion,
  emotionForm,
  saveEmotion,
  resetEmotionForm,
  emotionPresets,
  isSystemEmotion,
  editEmotion,
  deleteEmotion
} = useWorkbenchContext()

/** 情绪向量维度标签。 */
const emotionAxisLabels = ['高兴', '生气', '伤心', '害怕', '厌恶', '低落', '惊喜', '平静']

/** 仅展示允许编辑的非系统情绪。 */
const editableEmotionPresets = computed(() =>
  emotionPresets.value.filter((preset: { name: string }) => !isSystemEmotion(preset.name))
)

/** 音色参考文件选择器。 */
const timbreFileInput = useTemplateRef<HTMLInputElement>('timbreFileInput')

/** 打开音色文件选择框。 */
const openTimbreFileDialog = (): void => {
  timbreFileInput.value?.click()
}
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-6">
      <h2 class="text-lg font-bold text-slate-800 border-b pb-2">音色管理</h2>

      <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 class="text-sm font-bold text-slate-700 mb-4">{{ isEditingTimbre ? '编辑音色' : '添加新音色' }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">音色名称</label>
            <input
              v-model="timbreForm.name"
              class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如: 旁白 / 少年音"
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">音色描述 (用于 AI 自动匹配)</label>
            <input
              v-model="timbreForm.description"
              class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如: 声音低沉，适合反派或中年男性"
            />
          </div>
          <div class="md:col-span-2">
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">参考音频文件</label>
            <div class="flex gap-2 items-center">
              <input ref="timbreFileInput" type="file" accept=".wav,.mp3" class="hidden" @change="handleTimbreFileUpload" />
              <button
                type="button"
                class="whitespace-nowrap px-3 py-2 bg-slate-100 border border-slate-300 text-slate-600 rounded-lg text-xs hover:bg-slate-200 transition-colors"
                @click="openTimbreFileDialog"
              >
                选择文件
              </button>
              <input
                v-model="timbreForm.refPath"
                class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="选择一个音频文件作为音色参考"
              />
            </div>
            <p class="text-[10px] text-slate-400 mt-1">提示：选择的音频文件将保存在本地，生成音频时会自动上传。</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
            @click.prevent="saveTimbre"
          >
            保存音色
          </button>
          <button
            v-if="isEditingTimbre"
            type="button"
            class="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-all"
            @click="resetTimbreForm"
          >
            取消
          </button>
        </div>
      </div>

      <div class="grid gap-3">
        <div
          v-for="timbre in timbres"
          :key="timbre.id"
          class="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
              {{ timbre.name.charAt(0) }}
            </div>
            <div>
              <div class="font-bold text-slate-800 text-sm">{{ timbre.name }}</div>
              <div v-if="timbre.description" class="text-xs text-slate-500 mt-0.5">{{ timbre.description }}</div>
              <div class="text-xs text-slate-400 mt-1">{{ timbre.refPath }}</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="text-xs text-slate-400 hover:text-green-600 mr-1" title="试听" @click="playPreview(timbre.refPath)">
              <svg
                v-if="previewPlayingFile === timbre.refPath"
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
            <button class="text-xs text-blue-600 hover:underline font-medium" @click="editTimbre(timbre)">编辑</button>
            <button class="text-xs text-red-500 hover:underline font-medium" @click="deleteTimbre(timbre.id)">删除</button>
          </div>
        </div>
        <div v-if="timbres.length === 0" class="text-center py-8 text-slate-400 text-sm">暂无音色，请在上方添加</div>
      </div>
    </section>

    <section class="space-y-6">
      <h2 class="text-lg font-bold text-slate-800 border-b pb-2">情绪描述预设</h2>

      <div class="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 class="text-sm font-bold text-slate-700 mb-4">{{ isEditingEmotion ? '编辑情绪预设' : '添加新情绪预设' }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">情绪名称</label>
            <input
              v-model="emotionForm.name"
              class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例如: 开心 / 愤怒"
            />
          </div>
          <div class="md:col-span-2">
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-2">
              8维情感向量 (对应: 高兴, 生气, 伤心, 害怕, 厌恶, 低落, 惊喜, 平静)
              <span class="text-slate-400 font-normal ml-2 normal-case">提示：所有值必须在 0.0 到 1.0 之间</span>
            </label>
            <div class="grid grid-cols-4 md:grid-cols-8 gap-2">
              <div v-for="(_, idx) in 8" :key="idx" class="flex flex-col items-center">
                <span class="text-[8px] text-slate-400 mb-1">{{ emotionAxisLabels[idx] }}</span>
                <input
                  v-model.number="emotionForm.vector[idx]"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  class="w-full px-1 py-1 border rounded text-xs text-center focus:ring-1 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all"
            @click.prevent="saveEmotion"
          >
            保存情绪
          </button>
          <button
            v-if="isEditingEmotion"
            type="button"
            class="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition-all"
            @click="resetEmotionForm"
          >
            取消
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="emotion in editableEmotionPresets"
          :key="emotion.id"
          class="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow flex justify-between items-center"
        >
          <div class="flex items-center gap-3">
            <input
              v-model="emotion.enabled"
              type="checkbox"
              class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              title="启用/禁用此情绪"
            />
            <div>
              <div class="font-bold text-slate-800 text-sm">{{ emotion.name }}</div>
              <div v-if="emotion.vector" class="text-[8px] text-slate-400 mt-1 font-mono tracking-tighter">[{{ emotion.vector.join(',') }}]</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="text-xs text-blue-600 hover:underline" @click="editEmotion(emotion)">编辑</button>
            <button class="text-xs text-red-500 hover:underline" @click="deleteEmotion(emotion.id)">删除</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
