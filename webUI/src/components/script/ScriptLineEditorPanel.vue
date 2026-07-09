<script setup lang="ts">
import { computed, watch } from 'vue';

import { useAssetRecovery } from '../../composables/useAssetRecovery';
import type { DialogueSfxCue, ScriptLine } from '../../domain/project';

const props = defineProps<{
  activePlaybackLineId: string;
  availableRoles: string[];
  bgmNames: string[];
  emotionNames: string[];
  filterNames: string[];
  lines: ScriptLine[];
  playbackMode: 'idle' | 'preview' | 'sequence';
  playbackProgress: number;
  selectedLineId: string;
  sfxNames: string[];
}>();

const emit = defineEmits<{
  addBgImage: [];
  addBgm: [];
  addDialogue: [];
  clearLineAudio: [lineId: string];
  copyBgImagePrompt: [lineId: string];
  generateLineAudio: [lineId: string];
  moveLine: [payload: { direction: 'up' | 'down'; lineId: string }];
  playLineAudio: [lineId: string];
  removeLine: [lineId: string];
  selectLine: [lineId: string];
  uploadBgImage: [payload: { file: File; lineId: string }];
  updateLine: [payload: { lineId: string; patch: Partial<ScriptLine> }];
}>();

const dialogueAssetKeys = computed(() =>
  props.lines
    .filter((line) => line.type === 'dialogue')
    .map((line) => line.audioAssetKey)
);
const bgImageAssetKeys = computed(() =>
  props.lines
    .filter((line) => line.type === 'bgImage')
    .map((line) => line.bgImageAssetKey)
);
const { assetStatusByKey, assetUrlByKey, refreshAssetStatus, refreshImageAsset } = useAssetRecovery({
  statusKeys: computed(() => [...dialogueAssetKeys.value, ...bgImageAssetKeys.value]),
  imageKeys: bgImageAssetKeys
});

const updateCueList = (
  lineId: string,
  cues: DialogueSfxCue[]
) => {
  emit('updateLine', { lineId, patch: { sfx: cues } });
};

const resolveAssetStatusLabel = (assetKey: string) => {
  if (!assetKey) {
    return '未绑定';
  }

  if (assetStatusByKey[assetKey] === 'present') {
    return '已恢复';
  }

  if (assetStatusByKey[assetKey] === 'missing') {
    return '缺失';
  }

  return '检测中';
};

const resolveAssetStatusClass = (assetKey: string) => {
  if (!assetKey) {
    return 'asset-pill--empty';
  }

  if (assetStatusByKey[assetKey] === 'present') {
    return 'asset-pill--present';
  }

  if (assetStatusByKey[assetKey] === 'missing') {
    return 'asset-pill--missing';
  }

  return 'asset-pill--pending';
};

watch(
  () =>
    props.lines.map((line) =>
      line.type === 'dialogue'
        ? `${line.id}:${line.audioAssetKey}:${line.audioUrl}`
        : line.type === 'bgImage'
          ? `${line.id}:${line.bgImageAssetKey}:${line.imageUrl}`
          : line.id
    ),
  () => {
    dialogueAssetKeys.value.forEach((key) => {
      void refreshAssetStatus(key);
    });
    bgImageAssetKeys.value.forEach((key) => {
      void refreshImageAsset(key);
    });
  },
  { immediate: true }
);

const isAssetPresent = (assetKey: string) => assetStatusByKey[assetKey] === 'present';

const resolveBgPreviewUrl = (assetKey: string, runtimeUrl: string) =>
  assetUrlByKey[assetKey] || runtimeUrl;

const handleBgImageFileChange = (lineId: string, event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  emit('uploadBgImage', { file, lineId });
  input.value = '';
};
</script>

<template>
  <article class="card">
    <header class="header">
      <div>
        <p class="eyebrow">脚本块列表</p>
        <h3 class="title">Dialogue / BGM / bgImage</h3>
      </div>
      <div class="toolbar">
        <button type="button" class="secondary" @click="emit('addDialogue')">新增台词</button>
        <button type="button" class="secondary" @click="emit('addBgm')">新增 BGM</button>
        <button type="button" class="secondary" @click="emit('addBgImage')">
          新增背景图
        </button>
      </div>
    </header>

    <datalist id="script-role-options">
      <option v-for="role in props.availableRoles" :key="role" :value="role" />
    </datalist>

    <div v-if="props.lines.length" class="line-list">
      <article
        v-for="(line, index) in props.lines"
        :key="line.id"
        class="line-card"
        :class="{ 'line-card--selected': line.id === props.selectedLineId }"
        @click="emit('selectLine', line.id)"
      >
        <div class="line-top">
          <div class="line-heading">
            <span class="line-index">#{{ index + 1 }}</span>
            <span class="line-type">{{ line.type }}</span>
          </div>
          <div class="line-actions">
            <button
              type="button"
              class="ghost"
              @click.stop="emit('moveLine', { lineId: line.id, direction: 'up' })"
            >
              上移
            </button>
            <button
              type="button"
              class="ghost"
              @click.stop="emit('moveLine', { lineId: line.id, direction: 'down' })"
            >
              下移
            </button>
            <button
              type="button"
              class="ghost ghost--danger"
              @click.stop="emit('removeLine', line.id)"
            >
              删除
            </button>
          </div>
        </div>

        <div v-if="line.type === 'dialogue'" class="line-grid">
          <div class="runtime-toolbar field--wide">
            <button
              type="button"
              class="ghost"
              @click.stop="emit('generateLineAudio', line.id)"
            >
              {{ line.isGenerating ? '停止生成' : '生成音频' }}
            </button>
            <button
              type="button"
              class="ghost"
              :disabled="!isAssetPresent(line.audioAssetKey)"
              @click.stop="emit('playLineAudio', line.id)"
            >
              {{
                props.activePlaybackLineId === line.id && props.playbackMode === 'preview'
                  ? '停止试听'
                  : props.activePlaybackLineId === line.id && props.playbackMode === 'sequence'
                    ? '顺序播放中'
                    : '试听'
              }}
            </button>
            <button
              type="button"
              class="ghost ghost--danger"
              :disabled="!isAssetPresent(line.audioAssetKey)"
              @click.stop="emit('clearLineAudio', line.id)"
            >
              清空音频
            </button>
          </div>

          <label class="field">
            <span class="field-label">角色</span>
            <input
              :value="line.role"
              class="field-input"
              list="script-role-options"
              type="text"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { role: ($event.target as HTMLInputElement).value }
                })
              "
            />
          </label>

          <label class="field">
            <span class="field-label">情绪</span>
            <select
              :value="line.emotion"
              class="field-input"
              @click.stop
              @change="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { emotion: ($event.target as HTMLSelectElement).value }
                })
              "
            >
              <option value="">未设置</option>
              <option v-for="emotion in props.emotionNames" :key="emotion" :value="emotion">
                {{ emotion }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">强度</span>
            <select
              :value="line.intensity"
              class="field-input"
              @click.stop
              @change="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { intensity: ($event.target as HTMLSelectElement).value }
                })
              "
            >
              <option value="微弱">微弱</option>
              <option value="稍弱">稍弱</option>
              <option value="中等">中等</option>
              <option value="较强">较强</option>
              <option value="强烈">强烈</option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">滤波器</span>
            <select
              :value="line.filter"
              class="field-input"
              @click.stop
              @change="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { filter: ($event.target as HTMLSelectElement).value }
                })
              "
            >
              <option value="">未设置</option>
              <option v-for="filterName in props.filterNames" :key="filterName" :value="filterName">
                {{ filterName }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">停顿时长</span>
            <input
              :value="line.break_duration"
              class="field-input"
              type="number"
              min="0"
              step="0.1"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: {
                    break_duration: Number(($event.target as HTMLInputElement).value || 0)
                  }
                })
              "
            />
          </label>

          <label class="field">
            <span class="field-label">语速</span>
            <input
              :value="line.speed"
              class="field-input"
              type="number"
              min="0.5"
              max="2"
              step="0.05"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { speed: Number(($event.target as HTMLInputElement).value || 1) }
                })
              "
            />
          </label>

          <label class="field">
            <span class="field-label">裁剪起点</span>
            <input
              :value="line.trimStart"
              class="field-input"
              type="number"
              min="0"
              max="1"
              step="0.01"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { trimStart: Number(($event.target as HTMLInputElement).value || 0) }
                })
              "
            />
          </label>

          <label class="field">
            <span class="field-label">裁剪终点</span>
            <input
              :value="line.trimEnd"
              class="field-input"
              type="number"
              min="0"
              max="1"
              step="0.01"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { trimEnd: Number(($event.target as HTMLInputElement).value || 1) }
                })
              "
            />
          </label>

          <label class="field">
            <span class="field-label">台词音量</span>
            <input
              :value="line.dialogueVolume"
              class="field-input"
              type="number"
              min="0"
              max="2"
              step="0.05"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: {
                    dialogueVolume: Number(($event.target as HTMLInputElement).value || 1)
                  }
                })
              "
            />
          </label>

          <label class="field">
            <span class="field-label">SFX 音量</span>
            <input
              :value="line.sfxVolume"
              class="field-input"
              type="number"
              min="0"
              max="2"
              step="0.05"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { sfxVolume: Number(($event.target as HTMLInputElement).value || 1) }
                })
              "
            />
          </label>

          <label class="field field--wide">
            <span class="field-label">台词文本</span>
            <textarea
              :value="line.text"
              class="textarea"
              spellcheck="false"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { text: ($event.target as HTMLTextAreaElement).value }
                })
              "
            />
          </label>

          <section class="cue-section field--wide">
            <div class="cue-header">
              <span class="field-label">SFX 提示点</span>
              <button
                type="button"
                class="ghost"
                @click.stop="
                  updateCueList(line.id, [
                    ...line.sfx,
                    { name: props.sfxNames[0] ?? '', position: 0 }
                  ])
                "
              >
                新增 Cue
              </button>
            </div>

            <div v-if="line.sfx.length" class="cue-list">
              <div v-for="(cue, cueIndex) in line.sfx" :key="`${line.id}_${cueIndex}`" class="cue-row">
                <select
                  :value="cue.name"
                  class="field-input"
                  @click.stop
                  @change="
                    updateCueList(
                      line.id,
                      line.sfx.map((item, indexValue) =>
                        indexValue === cueIndex
                          ? { ...item, name: ($event.target as HTMLSelectElement).value }
                          : item
                      )
                    )
                  "
                >
                  <option value="">未设置</option>
                  <option v-for="sfxName in props.sfxNames" :key="sfxName" :value="sfxName">
                    {{ sfxName }}
                  </option>
                </select>
                <input
                  :value="cue.position"
                  class="field-input"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  @click.stop
                  @input="
                    updateCueList(
                      line.id,
                      line.sfx.map((item, indexValue) =>
                        indexValue === cueIndex
                          ? {
                              ...item,
                              position: Number(($event.target as HTMLInputElement).value || 0)
                            }
                          : item
                      )
                    )
                  "
                />
                <button
                  type="button"
                  class="ghost ghost--danger"
                  @click.stop="
                    updateCueList(
                      line.id,
                      line.sfx.filter((_, indexValue) => indexValue !== cueIndex)
                    )
                  "
                >
                  删除
                </button>
              </div>
            </div>
            <p v-else class="empty-tip">当前没有 SFX 提示点。</p>
          </section>

          <div
            v-if="props.activePlaybackLineId === line.id"
            class="progress-card field--wide"
          >
            <div class="progress-label-row">
              <span class="field-label">
                {{ props.playbackMode === 'sequence' ? '顺序播放进度' : '试听进度' }}
              </span>
              <span class="progress-value">{{ Math.round(props.playbackProgress * 100) }}%</span>
            </div>
            <div class="progress-track">
              <div
                class="progress-bar"
                :style="{ width: `${Math.max(0, Math.min(100, props.playbackProgress * 100))}%` }"
              ></div>
            </div>
          </div>

          <div class="status-row field--wide">
            <span class="asset-pill" :class="resolveAssetStatusClass(line.audioAssetKey)">
              {{ resolveAssetStatusLabel(line.audioAssetKey) }}
            </span>
            <p class="asset-note">`audioAssetKey`：{{ line.audioAssetKey }}</p>
          </div>
        </div>

        <div v-else-if="line.type === 'bgm'" class="line-grid">
          <label class="field">
            <span class="field-label">动作</span>
            <select
              :value="line.action"
              class="field-input"
              @click.stop
              @change="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { action: ($event.target as HTMLSelectElement).value }
                })
              "
            >
              <option value="play">播放</option>
              <option value="stop">停止</option>
            </select>
          </label>

          <label v-if="line.action === 'play'" class="field">
            <span class="field-label">BGM 名称</span>
            <select
              :value="line.bgmName"
              class="field-input"
              @click.stop
              @change="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { bgmName: ($event.target as HTMLSelectElement).value }
                })
              "
            >
              <option value="">未设置</option>
              <option v-for="bgmName in props.bgmNames" :key="bgmName" :value="bgmName">
                {{ bgmName }}
              </option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">音量</span>
            <input
              :value="line.volume"
              class="field-input"
              type="number"
              min="0"
              max="2"
              step="0.05"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { volume: Number(($event.target as HTMLInputElement).value || 0) }
                })
              "
            />
          </label>
        </div>

        <div v-else class="line-grid">
          <label class="field field--wide">
            <span class="field-label">背景图 Prompt</span>
            <textarea
              :value="line.bgImagePrompt"
              class="textarea"
              spellcheck="false"
              @click.stop
              @input="
                emit('updateLine', {
                  lineId: line.id,
                  patch: { bgImagePrompt: ($event.target as HTMLTextAreaElement).value }
                })
              "
            />
          </label>

          <label class="field field--wide">
            <span class="field-label">背景图资源键</span>
            <input :value="line.bgImageAssetKey" class="field-input" type="text" readonly />
          </label>

          <div class="bg-actions field--wide">
            <label class="upload-button" @click.stop>
              上传背景图
              <input
                class="hidden-input"
                type="file"
                accept="image/*"
                @change="handleBgImageFileChange(line.id, $event)"
              />
            </label>
            <button
              type="button"
              class="ghost"
              :disabled="!line.bgImagePrompt"
              @click.stop="emit('copyBgImagePrompt', line.id)"
            >
              复制 Prompt
            </button>
          </div>

          <div class="status-row field--wide">
            <span class="asset-pill" :class="resolveAssetStatusClass(line.bgImageAssetKey)">
              {{ resolveAssetStatusLabel(line.bgImageAssetKey) }}
            </span>
            <p class="asset-note">`bgImageAssetKey`：{{ line.bgImageAssetKey || '尚未绑定本地图片' }}</p>
          </div>

          <div
            v-if="resolveBgPreviewUrl(line.bgImageAssetKey, line.imageUrl)"
            class="preview-card field--wide"
          >
            <img
              :src="resolveBgPreviewUrl(line.bgImageAssetKey, line.imageUrl)"
              alt="背景图预览"
              class="preview-image"
            />
          </div>
        </div>
      </article>
    </div>
    <p v-else class="empty">当前脚本还没有任何块，先从上方工具栏插入一条。</p>
  </article>
</template>

<style scoped>
.card {
  padding: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #4f46e5;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title {
  margin: 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.secondary,
.ghost {
  border: none;
  border-radius: 999px;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 700;
}

.secondary {
  background: rgba(79, 70, 229, 0.12);
  color: #312e81;
}

.ghost {
  background: transparent;
  color: #334155;
}

.ghost--danger {
  color: #dc2626;
}

.line-list {
  display: grid;
  gap: 16px;
}

.line-card {
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 20px;
  background: #f8fafc;
  cursor: pointer;
}

.line-card--selected {
  border-color: rgba(79, 70, 229, 0.3);
  box-shadow: inset 0 0 0 1px rgba(79, 70, 229, 0.14);
}

.line-top,
.line-heading,
.line-actions,
.cue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.line-top {
  margin-bottom: 14px;
}

.line-index,
.line-type {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.12);
  color: #312e81;
  font-size: 0.8rem;
  font-weight: 700;
}

.line-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.runtime-toolbar,
.bg-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.field {
  display: grid;
  gap: 8px;
}

.field--wide {
  grid-column: 1 / -1;
}

.field-label {
  color: #475569;
  font-size: 0.9rem;
  font-weight: 700;
}

.field-input,
.textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  background: #fff;
}

.textarea {
  min-height: 110px;
  resize: vertical;
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
}

.cue-section {
  display: grid;
  gap: 10px;
}

.cue-list {
  display: grid;
  gap: 10px;
}

.cue-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr auto;
  gap: 10px;
}

.progress-card {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
}

.progress-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.progress-value {
  color: #4f46e5;
  font-size: 0.84rem;
  font-weight: 700;
}

.progress-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4f46e5, #0ea5e9);
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.asset-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 700;
}

.asset-pill--present {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.asset-pill--missing {
  background: rgba(239, 68, 68, 0.14);
  color: #b91c1c;
}

.asset-pill--pending,
.asset-pill--empty {
  background: rgba(148, 163, 184, 0.16);
  color: #475569;
}

.preview-card {
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
}

.upload-button {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 10px 14px;
  background: rgba(148, 163, 184, 0.16);
  color: #334155;
  cursor: pointer;
  font-weight: 700;
}

.hidden-input {
  display: none;
}

.preview-image {
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: cover;
}

.asset-note,
.empty,
.empty-tip {
  color: #64748b;
}

@media (max-width: 980px) {
  .header,
  .line-top,
  .runtime-toolbar,
  .bg-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .line-grid {
    grid-template-columns: 1fr;
  }

  .cue-row {
    grid-template-columns: 1fr;
  }
}
</style>
