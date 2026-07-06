<script setup lang="ts">
/**
 * @fileoverview 音色与情绪资源标签页
 * @description 使用 Element Plus 维护音色资源和情绪描述预设
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

const emotionAxisLabels = ['高兴', '生气', '伤心', '害怕', '厌恶', '低落', '惊喜', '平静']

const editableEmotionPresets = computed(() =>
  emotionPresets.value.filter((preset: { name: string }) => !isSystemEmotion(preset.name))
)

const timbreFileInput = useTemplateRef<HTMLInputElement>('timbreFileInput')

const openTimbreFileDialog = (): void => {
  timbreFileInput.value?.click()
}
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-6">
      <el-card shadow="never">
        <template #header>
          <div class="font-bold text-slate-800">音色管理</div>
        </template>

        <el-form :model="timbreForm" label-position="top">
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <el-form-item label="音色名称">
                <el-input v-model="timbreForm.name" clearable placeholder="例如: 旁白 / 少年音" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="音色描述 (用于 AI 自动匹配)">
                <el-input v-model="timbreForm.description" clearable placeholder="例如: 声音低沉，适合反派或中年男性" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="参考音频文件">
                <el-input v-model="timbreForm.refPath" clearable placeholder="选择一个音频文件作为音色参考">
                  <template #prepend>
                    <el-button @click="openTimbreFileDialog">
                      <el-icon><FolderOpened /></el-icon>
                      <span>选择文件</span>
                    </el-button>
                  </template>
                </el-input>
                <input ref="timbreFileInput" type="file" accept=".wav,.mp3" class="hidden" @change="handleTimbreFileUpload" />
                <div class="text-xs text-slate-400 mt-1">提示：选择的音频文件将保存在本地，生成音频时会自动上传。</div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-space>
            <el-button type="primary" @click.prevent="saveTimbre">
              <el-icon><Check /></el-icon>
              <span>保存音色</span>
            </el-button>
            <el-button v-if="isEditingTimbre" @click="resetTimbreForm">
              <el-icon><Close /></el-icon>
              <span>取消</span>
            </el-button>
          </el-space>
        </el-form>
      </el-card>

      <div class="grid gap-3">
        <el-card v-for="timbre in timbres" :key="timbre.id" shadow="hover">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <el-avatar class="flex-shrink-0" :size="40">{{ timbre.name.charAt(0) }}</el-avatar>
              <div class="min-w-0">
                <div class="font-bold text-slate-800 text-sm">{{ timbre.name }}</div>
                <div v-if="timbre.description" class="text-xs text-slate-500 mt-0.5">{{ timbre.description }}</div>
                <div class="text-xs text-slate-400 mt-1 break-all">{{ timbre.refPath }}</div>
              </div>
            </div>
            <el-space>
              <el-button
                :type="previewPlayingFile === timbre.refPath ? 'success' : 'info'"
                link
                @click="playPreview(timbre.refPath)"
              >
                {{ previewPlayingFile === timbre.refPath ? '停止' : '试听' }}
              </el-button>
              <el-button type="primary" link @click="editTimbre(timbre)">编辑</el-button>
              <el-button type="danger" link @click="deleteTimbre(timbre.id)">删除</el-button>
            </el-space>
          </div>
        </el-card>
        <el-empty v-if="timbres.length === 0" description="暂无音色，请在上方添加" />
      </div>
    </section>

    <section class="space-y-6">
      <el-card shadow="never">
        <template #header>
          <div class="font-bold text-slate-800">情绪描述预设</div>
        </template>

        <el-form :model="emotionForm" label-position="top">
          <el-row :gutter="16">
            <el-col :xs="24" :md="12">
              <el-form-item label="情绪名称">
                <el-input v-model="emotionForm.name" clearable placeholder="例如: 开心 / 愤怒" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item>
                <template #label>
                  <span>8维情感向量</span>
                  <span class="text-slate-400 font-normal ml-2">所有值必须在 0.0 到 1.0 之间</span>
                </template>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 w-full">
                  <div v-for="(_, idx) in 8" :key="idx" class="space-y-1">
                    <div class="text-[10px] text-slate-500 font-bold">{{ emotionAxisLabels[idx] }}</div>
                    <el-input-number
                      v-model="emotionForm.vector[idx]"
                      :min="0"
                      :max="1"
                      :step="0.1"
                      size="small"
                      controls-position="right"
                      class="w-full"
                    />
                  </div>
                </div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-space>
            <el-button type="success" @click.prevent="saveEmotion">
              <el-icon><Check /></el-icon>
              <span>保存情绪</span>
            </el-button>
            <el-button v-if="isEditingEmotion" @click="resetEmotionForm">
              <el-icon><Close /></el-icon>
              <span>取消</span>
            </el-button>
          </el-space>
        </el-form>
      </el-card>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <el-card v-for="emotion in editableEmotionPresets" :key="emotion.id" shadow="hover">
          <div class="flex justify-between items-center gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <el-checkbox v-model="emotion.enabled" title="启用/禁用此情绪" />
              <div class="min-w-0">
                <div class="font-bold text-slate-800 text-sm">{{ emotion.name }}</div>
                <div v-if="emotion.vector" class="text-[10px] text-slate-400 mt-1 font-mono break-all">[{{ emotion.vector.join(',') }}]</div>
              </div>
            </div>
            <el-space>
              <el-button type="primary" link @click="editEmotion(emotion)">编辑</el-button>
              <el-button type="danger" link @click="deleteEmotion(emotion.id)">删除</el-button>
            </el-space>
          </div>
        </el-card>
      </div>
    </section>
  </div>
</template>
