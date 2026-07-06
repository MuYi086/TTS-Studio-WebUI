<script setup lang="ts">
/**
 * @fileoverview 脚本角色侧栏
 * @description 维护角色、音色绑定、角色音量和角色音色生成动作
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
  <aside class="w-full lg:w-60 flex-shrink-0 space-y-4">
    <div class="bg-slate-100 p-4 rounded-xl border border-slate-200">
      <h3 class="text-sm font-bold text-slate-700 mb-3 flex justify-between items-center">
        角色列表
        <button class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700" @click="addCharacter">+ 新增</button>
      </h3>
      <div class="space-y-3 pr-1">
        <div
          v-for="char in characters"
          :key="char.id"
          class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm space-y-2"
        >
          <div class="flex justify-between items-center">
            <input
              v-model="char.name"
              class="font-bold text-slate-800 w-2/3 bg-transparent border-b border-transparent focus:border-blue-500 outline-none px-1"
              placeholder="角色名"
            />
            <button class="text-slate-400 hover:text-red-500" @click="deleteCharacter(char.id)">x</button>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">音色选择</label>
            <div class="flex gap-1">
              <select
                v-model="char.voiceFile"
                class="flex-1 px-2 py-1.5 border rounded-md text-xs bg-white outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- 请选择音色 --</option>
                <option v-for="timbre in timbres" :key="timbre.id" :value="timbre.refPath">{{ timbre.name }}</option>
              </select>
              <button
                :disabled="!char.voiceFile"
                class="px-2 bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-green-600 disabled:opacity-50"
                title="试听当前音色"
                @click="playPreview(char.voiceFile)"
              >
                <svg
                  v-if="previewPlayingFile === char.voiceFile"
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
            </div>
          </div>

          <div class="mt-2 pt-2 border-t border-slate-100">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] font-bold text-slate-500 uppercase">角色音量</span>
              <span class="text-[10px] text-slate-500 font-mono">{{ Math.round((char.volume ?? 1) * 100) }}%</span>
            </div>
            <input
              v-model.number="char.volume"
              type="range"
              min="0"
              max="2"
              step="0.05"
              class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 block"
            />
          </div>

          <div class="mt-2 pt-2 border-t border-slate-100 space-y-2">
            <textarea
              v-model="char.voiceDescription"
              rows="2"
              class="w-full px-2 py-1.5 text-[10px] border rounded bg-slate-50 focus:ring-1 focus:ring-blue-500 outline-none resize-none text-slate-600"
              placeholder="音色描述 (例如: 甜美少女音)"
            ></textarea>
            <div class="flex gap-1">
              <button
                :class="['flex-1 px-2 py-1.5 border rounded text-[10px] font-bold transition-colors flex justify-center items-center gap-1', char.isAnalyzing ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100']"
                @click="analyzeCharacterVoice(char)"
              >
                <span v-if="char.isAnalyzing" class="animate-spin">...</span>{{ char.isAnalyzing ? '停止分析' : 'AI分析音色' }}
              </button>
              <button
                :class="['flex-1 px-2 py-1.5 border rounded text-[10px] font-bold transition-colors flex justify-center items-center gap-1', char.isGeneratingVoice ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-pink-50 text-pink-600 border-pink-100 hover:bg-pink-100']"
                @click="generateQwenVoice(char)"
              >
                <span v-if="char.isGeneratingVoice" class="animate-spin">...</span>{{ char.isGeneratingVoice ? '停止生成' : 'Qwen生成音色' }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="characters.length === 0" class="text-center text-xs text-slate-400 py-4">暂无角色，请点击新增</div>
      </div>
    </div>
  </aside>
</template>
