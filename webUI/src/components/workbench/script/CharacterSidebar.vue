<script setup lang="ts">
/**
 * @fileoverview 脚本角色侧栏
 * @description 使用 Element Plus 维护角色、音色绑定、角色音量和角色音色生成动作
 * @module src/components/workbench/script/CharacterSidebar
 */
import { useWorkbenchContext } from '../../../composables/useWorkbenchContext'

const {
  characters,
  addCharacter,
  deleteCharacter,
  timbres,
  playPreview,
  previewPlayingFile,
  analyzeCharacterVoice,
  generateQwenVoice
} = useWorkbenchContext()
</script>

<template>
  <aside class="w-full lg:w-64 flex-shrink-0 space-y-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="text-sm font-bold text-slate-700">角色列表</span>
          <el-button type="primary" size="small" @click="addCharacter">
            <el-icon><Plus /></el-icon>
            <span>新增</span>
          </el-button>
        </div>
      </template>

      <div class="space-y-3 pr-1">
        <el-card v-for="char in characters" :key="char.id" shadow="hover">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <el-input v-model="char.name" size="small" placeholder="角色名" />
              <el-button type="danger" link @click="deleteCharacter(char.id)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>

            <el-form label-position="top" size="small">
              <el-form-item label="音色选择">
                <div class="flex gap-2 w-full">
                  <el-select v-model="char.voiceFile" filterable clearable placeholder="请选择音色" class="flex-1">
                    <el-option v-for="timbre in timbres" :key="timbre.id" :label="timbre.name" :value="timbre.refPath" />
                  </el-select>
                  <el-button
                    :disabled="!char.voiceFile"
                    :type="previewPlayingFile === char.voiceFile ? 'success' : 'info'"
                    plain
                    @click="playPreview(char.voiceFile)"
                  >
                    {{ previewPlayingFile === char.voiceFile ? '停' : '听' }}
                  </el-button>
                </div>
              </el-form-item>
            </el-form>

            <div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-bold text-slate-500 uppercase">角色音量</span>
                <span class="text-[10px] text-slate-500 font-mono">{{ Math.round((char.volume ?? 1) * 100) }}%</span>
              </div>
              <el-slider v-model="char.volume" :min="0" :max="2" :step="0.05" />
            </div>

            <el-input
              v-model="char.voiceDescription"
              type="textarea"
              :rows="2"
              resize="none"
              placeholder="音色描述 (例如: 甜美少女音)"
            />

            <el-space wrap>
              <el-button
                size="small"
                :type="char.isAnalyzing ? 'danger' : 'primary'"
                plain
                @click="analyzeCharacterVoice(char)"
              >
                {{ char.isAnalyzing ? '停止分析' : 'AI分析音色' }}
              </el-button>
              <el-button
                size="small"
                :type="char.isGeneratingVoice ? 'danger' : 'success'"
                plain
                @click="generateQwenVoice(char)"
              >
                {{ char.isGeneratingVoice ? '停止生成' : 'Qwen生成音色' }}
              </el-button>
            </el-space>
          </div>
        </el-card>
        <el-empty v-if="characters.length === 0" description="暂无角色，请点击新增" />
      </div>
    </el-card>
  </aside>
</template>
