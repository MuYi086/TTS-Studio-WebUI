<script setup lang="ts">
import type { VoiceDesignOption } from '../../services/providers/voiceDesignCatalog';

defineProps<{
  bgImageCount: number;
  exportStatus: string;
  isAnalyzingScript: boolean;
  isExportingAudio: boolean;
  isGeneratingAll: boolean;
  isGeneratingVideo: boolean;
  isSequencePlaying: boolean;
  selectedLineId: string;
  selectedVoiceDesignUrl: string;
  stageBackgroundUrl: string;
  videoResolution: string;
  videoResolutionOptions: string[];
  voiceDesigns: VoiceDesignOption[];
}>();

const emit = defineEmits<{
  analyzeScript: [];
  clearAllAudio: [];
  exportAudio: [];
  exportSrt: [];
  generateAllLines: [];
  generateVideo: [];
  playSequence: [];
  syncTimbres: [];
  updateBgImageCount: [value: number];
  updateSelectedVoiceDesignUrl: [value: string];
  updateVideoResolution: [value: string];
}>();
</script>

<template>
  <article class="card">
    <header class="header">
      <div>
        <p class="eyebrow">P2 工作流</p>
        <h3 class="title">分析、生成、播放与导出</h3>
      </div>
      <p class="note">保持旧版协议和键名，先把运行时链路迁进新工程。</p>
    </header>

    <div class="section-grid">
      <section class="section-card">
        <div class="section-top">
          <div>
            <p class="section-kicker">AI 工作流</p>
            <h4 class="section-title">脚本分析与音色模型</h4>
          </div>
          <button type="button" class="primary" @click="emit('analyzeScript')">
            {{ isAnalyzingScript ? '停止分析' : 'LLM 深度分析' }}
          </button>
        </div>

        <label class="field">
          <span class="field-label">音色生成模型</span>
          <select
            :value="selectedVoiceDesignUrl"
            @change="
              emit(
                'updateSelectedVoiceDesignUrl',
                ($event.target as HTMLSelectElement).value
              )
            "
          >
            <option v-for="item in voiceDesigns" :key="item.url" :value="item.url">
              {{ item.name }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">背景图片块数量</span>
          <input
            :value="bgImageCount"
            type="number"
            min="0"
            max="100"
            @input="
              emit(
                'updateBgImageCount',
                Number(($event.target as HTMLInputElement).value || 0)
              )
            "
          />
        </label>

        <button type="button" class="secondary" @click="emit('syncTimbres')">
          同步音色到 TTS 服务
        </button>
      </section>

      <section class="section-card">
        <div class="section-top">
          <div>
            <p class="section-kicker">音频运行时</p>
            <h4 class="section-title">批量生成与顺序播放</h4>
          </div>
          <span class="badge">
            {{ selectedLineId ? `从 ${selectedLineId} 开始` : '从首行开始' }}
          </span>
        </div>

        <div class="button-grid">
          <button type="button" class="primary" @click="emit('generateAllLines')">
            {{ isGeneratingAll ? '停止批量生成' : '批量生成台词' }}
          </button>
          <button type="button" class="secondary" @click="emit('clearAllAudio')">
            清空全部台词音频
          </button>
          <button type="button" class="primary" @click="emit('playSequence')">
            {{ isSequencePlaying ? '停止顺序播放' : '顺序播放' }}
          </button>
        </div>
      </section>

      <section class="section-card">
        <div class="section-top">
          <div>
            <p class="section-kicker">导出链路</p>
            <h4 class="section-title">SRT / WAV / MP4</h4>
          </div>
          <span v-if="exportStatus" class="badge badge--busy">{{ exportStatus }}</span>
        </div>

        <label class="field">
          <span class="field-label">视频分辨率</span>
          <select
            :value="videoResolution"
            @change="
              emit(
                'updateVideoResolution',
                ($event.target as HTMLSelectElement).value
              )
            "
          >
            <option
              v-for="item in videoResolutionOptions"
              :key="item"
              :value="item"
            >
              {{ item }}
            </option>
          </select>
        </label>

        <div class="button-grid">
          <button type="button" class="secondary" :disabled="isExportingAudio" @click="emit('exportSrt')">
            导出 SRT
          </button>
          <button type="button" class="secondary" :disabled="isExportingAudio" @click="emit('exportAudio')">
            {{ isExportingAudio ? '导出 WAV 中...' : '导出 WAV' }}
          </button>
          <button type="button" class="primary" :disabled="isGeneratingVideo" @click="emit('generateVideo')">
            {{ isGeneratingVideo ? '生成 MP4 中...' : '生成 MP4' }}
          </button>
        </div>
      </section>
    </div>

    <section class="stage-card">
      <div class="stage-copy">
        <p class="section-kicker">舞台预览</p>
        <h4 class="section-title">顺序播放 / 视频导出背景</h4>
        <p class="note">顺序播放会预扫描起始位置前最近的 `bgImage` 与 `BGM` 状态。</p>
      </div>
      <div class="stage-preview">
        <img
          v-if="stageBackgroundUrl"
          :src="stageBackgroundUrl"
          alt="当前舞台背景"
          class="stage-image"
        />
        <p v-else class="empty">还没有可展示的背景图。</p>
      </div>
    </section>
  </article>
</template>

<style scoped>
.card {
  padding: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(79, 70, 229, 0.06), transparent 48%),
    rgba(255, 255, 255, 0.94);
}

.header,
.section-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header {
  margin-bottom: 18px;
}

.eyebrow,
.section-kicker {
  margin: 0 0 8px;
  color: #4f46e5;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title,
.section-title {
  margin: 0;
}

.note,
.empty {
  margin: 0;
  color: #64748b;
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.section-card,
.stage-card {
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.84);
}

.section-card {
  display: grid;
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field-label {
  color: #475569;
  font-size: 0.92rem;
  font-weight: 700;
}

.field input,
.field select {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  background: #fff;
}

.button-grid {
  display: grid;
  gap: 10px;
}

.primary,
.secondary {
  border: none;
  border-radius: 999px;
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 700;
}

.primary {
  background: #4f46e5;
  color: #fff;
}

.secondary {
  background: rgba(148, 163, 184, 0.16);
  color: #334155;
}

.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(15, 23, 42, 0.08);
  color: #334155;
  font-size: 0.8rem;
  font-weight: 700;
}

.badge--busy {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}

.stage-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.95fr);
  gap: 16px;
  margin-top: 16px;
}

.stage-preview {
  display: grid;
  place-items: center;
  min-height: 180px;
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(79, 70, 229, 0.12), transparent 48%),
    #dbe4f0;
}

.stage-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 1080px) {
  .section-grid,
  .stage-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .header,
  .section-top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
