<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef } from 'vue';

import { useAssetRecovery } from '../../composables/useAssetRecovery';
import { useLibraryAudioPreview } from '../../composables/useLibraryAudioPreview';
import type { AudioLibraryItem } from '../../domain/project';
import { useLibraryStore } from '../../stores/library.store';
import LibraryAudioPreview from './LibraryAudioPreview.vue';

const props = defineProps<{
  kind: 'sfx' | 'bgm';
  title: string;
  description: string;
  eyebrow: string;
}>();

const libraryStore = useLibraryStore();
const notice = shallowRef('');
const isEditing = shallowRef(false);
const isEditorOpen = shallowRef(false);
const form = ref<AudioLibraryItem>(libraryStore.createEmptyAudioLibraryItem());
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const audioRevision = shallowRef(0);
const { invalidateAsset } = useLibraryAudioPreview();

const items = computed(() =>
  props.kind === 'sfx' ? libraryStore.sfxLibrary : libraryStore.bgmLibrary
);
const assetKeys = computed(() => items.value.map((item) => item.assetKey));
const { assetStatusByKey } = useAssetRecovery({ statusKeys: assetKeys });

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

const resetForm = () => {
  form.value = libraryStore.createEmptyAudioLibraryItem();
  isEditing.value = false;
  isEditorOpen.value = false;
};

const openFilePicker = async () => {
  isEditorOpen.value = true;
  await nextTick();
  fileInputRef.value?.click();
};

const onSelectFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  const saved = await libraryStore.saveLibraryAudioFile(props.kind, file, form.value.assetKey);
  form.value.assetKey = saved.assetKey;
  form.value.filename = saved.filename;
  invalidateAsset(saved.assetKey, saved.filename);
  audioRevision.value += 1;
  await nextTick();
  notice.value = `已保存音频文件：${saved.filename}`;
  input.value = '';
};

const submit = async () => {
  if (!form.value.name || !form.value.filename) {
    notice.value = '请填写资源名称并选择一个音频文件。';
    return;
  }

  await libraryStore.saveAudioLibraryItem(props.kind, form.value);
  notice.value = isEditing.value ? '资源已更新。' : '资源已新增。';
  resetForm();
};

const startEdit = (item: AudioLibraryItem) => {
  form.value = { ...item };
  isEditing.value = true;
  isEditorOpen.value = true;
};

const toggleEnabled = async (item: AudioLibraryItem) => {
  await libraryStore.saveAudioLibraryItem(props.kind, {
    ...item,
    enabled: item.enabled === false
  });
  notice.value = item.enabled === false ? '资源已启用。' : '资源已停用。';
};

const remove = async (id: string) => {
  if (!window.confirm('确定删除此资源吗？')) {
    return;
  }

  await libraryStore.deleteAudioLibraryItem(props.kind, id);
  notice.value = '资源已删除。';
};
</script>

<template>
  <article class="card audio-library" :class="`audio-library--${props.kind}`">
    <header class="card-header">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
      </div>
      <p class="note">{{ description }}</p>
      <button type="button" class="secondary editor-toggle" @click="isEditorOpen = !isEditorOpen">
        {{ isEditorOpen ? '收起编辑器' : '新增资源' }}
      </button>
    </header>

    <div class="audio-library-content">
      <section class="audio-catalog" :aria-label="`${title} 列表`">
        <div class="catalog-meta">
          <span>{{ props.kind === 'sfx' ? '音效片段' : '音乐轨道' }}</span>
          <span>{{ items.length }} 条资源</span>
        </div>

        <div v-if="items.length" class="audio-grid">
          <article v-for="item in items" :key="item.id" class="audio-item">
            <div class="audio-item-top">
              <span class="audio-glyph" :class="`audio-glyph--${props.kind}`">
                {{ props.kind === 'sfx' ? '✦' : '♫' }}
              </span>
              <div class="list-copy">
                <h4>{{ item.name }}</h4>
                <p>{{ item.description || '未填写描述' }}</p>
              </div>
              <span class="asset-pill" :class="resolveAssetStatusClass(item.assetKey)">
                {{ resolveAssetStatusLabel(item.assetKey) }}
              </span>
            </div>
            <LibraryAudioPreview
              :asset-key="item.assetKey"
              :fallback-key="item.filename"
              :trim-start="item.trimStart"
              :trim-end="item.trimEnd"
              :volume="item.volume"
              :accent="props.kind === 'bgm' ? 'violet' : 'cyan'"
              :revision="audioRevision"
              compact
            />
            <p class="mono audio-meta">
              {{ item.filename }} · {{ Math.round(item.volume * 100) }}% · {{ item.trimStart }}~{{ item.trimEnd }}
            </p>
            <div class="audio-item-footer">
              <span class="mono">{{ item.assetKey || '未绑定 asset' }}</span>
              <div class="list-actions">
                <button
                  type="button"
                  class="resource-state"
                  :class="{ 'resource-state--off': item.enabled === false }"
                  @click="toggleEnabled(item)"
                >
                  {{ item.enabled === false ? '已停用' : '已启用' }}
                </button>
                <button type="button" class="ghost" @click="startEdit(item)">编辑</button>
                <button type="button" class="ghost ghost--danger" @click="remove(item.id)">删除</button>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="audio-empty">
          <span class="audio-glyph" :class="`audio-glyph--${props.kind}`">
            {{ props.kind === 'sfx' ? '✦' : '♫' }}
          </span>
          <div>
            <strong>素材库暂为空</strong>
            <p>导入音频后即可在这里管理资源、裁剪区间和默认音量。</p>
          </div>
          <button type="button" class="secondary" @click="openFilePicker">导入音频</button>
        </div>
      </section>

      <section v-if="isEditorOpen" class="audio-editor" :aria-label="`${title} 编辑器`">
        <p class="editor-kicker">素材编辑器</p>
        <div class="form-grid">
          <label class="field">
            <span>资源名称</span>
            <input v-model="form.name" type="text" placeholder="例如：雷声 / 悲伤钢琴" />
          </label>
          <label class="field">
            <span>默认音量</span>
            <input v-model.number="form.volume" type="number" min="0" max="2" step="0.05" />
          </label>
          <label class="field field--wide">
            <span>资源描述</span>
            <input v-model="form.description" type="text" placeholder="用于后续 AI 判断插入时机" />
          </label>
          <label class="field field--wide">
            <span>音频文件</span>
            <div class="file-row">
              <button type="button" class="secondary" @click="fileInputRef?.click()">选择文件</button>
              <input
                ref="fileInput"
                type="file"
                accept=".wav,.mp3"
                class="hidden-input"
                @change="onSelectFile"
              />
              <input
                v-model="form.filename"
                type="text"
                placeholder="选择一个音频文件并保存到 assets 仓库"
              />
            </div>
            <div class="status-row">
              <span class="asset-pill" :class="resolveAssetStatusClass(form.assetKey)">
                {{ resolveAssetStatusLabel(form.assetKey) }}
              </span>
              <span class="mono">{{ form.assetKey || '保存后生成 assetKey' }}</span>
            </div>
          </label>
          <div v-if="form.assetKey || form.filename" class="field field--wide waveform-editor">
            <span>试听与波形裁剪</span>
            <LibraryAudioPreview
              :asset-key="form.assetKey"
              :fallback-key="form.filename"
              :trim-start="form.trimStart"
              :trim-end="form.trimEnd"
              :volume="form.volume"
              :accent="props.kind === 'bgm' ? 'violet' : 'cyan'"
              :revision="audioRevision"
              editable
              @update:trim-start="form.trimStart = $event"
              @update:trim-end="form.trimEnd = $event"
            />
            <em>拖动青色与紫色手柄设置有效区间；试听、脚本播放与导出会使用同一裁剪值。</em>
          </div>
          <label class="field">
            <span>trimStart</span>
            <input v-model.number="form.trimStart" type="number" min="0" max="1" step="0.01" />
          </label>
          <label class="field">
            <span>trimEnd</span>
            <input v-model.number="form.trimEnd" type="number" min="0" max="1" step="0.01" />
          </label>
          <label class="field field--wide enabled-row">
            <span>资源状态</span>
            <input v-model="form.enabled" type="checkbox" />
            <em>{{ form.enabled ? '可用于脚本制作' : '已从脚本候选中停用' }}</em>
          </label>
        </div>

        <div class="actions">
          <button type="button" class="primary" @click="submit">
            {{ isEditing ? '更新资源' : '保存资源' }}
          </button>
          <button v-if="isEditing" type="button" class="secondary" @click="resetForm">取消编辑</button>
          <span v-if="notice" class="notice">{{ notice }}</span>
        </div>
      </section>
    </div>
  </article>
</template>

<style scoped>
.card {
  padding: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
}

.audio-library-content {
  display: grid;
  gap: 16px;
}

.audio-catalog,
.audio-editor {
  min-width: 0;
}

.editor-toggle {
  justify-self: start;
}

.audio-editor {
  padding: 15px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.46);
}

.editor-kicker,
.catalog-meta {
  margin: 0;
  color: #4f46e5;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.catalog-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #64748b;
  letter-spacing: 0.04em;
}

.editor-kicker {
  margin-bottom: 12px;
}

.card-header,
.actions,
.list-item,
.list-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-header {
  justify-content: space-between;
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

.card-header h3,
.list-copy h4,
.list-copy p {
  margin: 0;
}

.note,
.empty,
.list-copy p {
  color: #64748b;
}

.audio-grid {
  display: grid;
  gap: 10px;
}

.audio-library--bgm .audio-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.audio-item {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.7);
}

.audio-item-top,
.audio-item-footer,
.audio-empty {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audio-item-top .asset-pill {
  margin-left: auto;
}

.audio-item-footer {
  justify-content: space-between;
}

.audio-item-footer > .mono {
  max-width: 48%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-state {
  padding: 5px 9px;
  border: 1px solid rgba(50, 209, 140, 0.28);
  border-radius: 999px;
  background: rgba(50, 209, 140, 0.1);
  color: #9df4c8;
  font-size: 0.68rem;
  font-weight: 800;
  cursor: pointer;
}

.resource-state--off {
  border-color: rgba(131, 148, 184, 0.22);
  background: rgba(131, 148, 184, 0.08);
  color: var(--tts-text-muted);
}

.audio-glyph {
  display: inline-grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(56, 189, 248, 0.38);
  border-radius: 12px;
  background: rgba(56, 189, 248, 0.12);
  color: #0891b2;
  font-size: 1.15rem;
  font-weight: 800;
}

.audio-glyph--bgm {
  border-color: rgba(139, 92, 246, 0.38);
  background: rgba(139, 92, 246, 0.12);
  color: #7c3aed;
}

.audio-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 26px;
  overflow: hidden;
}

.audio-wave i {
  width: 2px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: linear-gradient(180deg, #22d3ee, #2563eb);
  opacity: 0.8;
}

.audio-library--bgm .audio-wave i {
  background: linear-gradient(180deg, #38bdf8, #8b5cf6);
}

.audio-wave i:nth-child(3n) { height: 21px; }
.audio-wave i:nth-child(4n) { height: 15px; }
.audio-wave i:nth-child(5n) { height: 7px; }
.audio-wave i:nth-child(7n) { height: 24px; }

.audio-meta {
  margin: 0;
  overflow: hidden;
  color: #64748b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-empty {
  min-height: 98px;
  padding: 16px;
  border: 1px dashed rgba(148, 163, 184, 0.36);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.4);
}

.audio-empty > div {
  min-width: 0;
  flex: 1;
}

.audio-empty strong,
.audio-empty p {
  display: block;
  margin: 0;
}

.audio-empty p {
  margin-top: 4px;
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.45;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
  color: #334155;
  font-size: 0.92rem;
  font-weight: 600;
}

.field--wide {
  grid-column: 1 / -1;
}

.waveform-editor {
  padding: 12px;
  border: 1px solid rgba(104, 159, 255, 0.18);
  border-radius: 14px;
  background: rgba(2, 10, 28, 0.4);
}

.waveform-editor > em {
  color: var(--tts-text-muted);
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 500;
}

.enabled-row {
  grid-template-columns: auto auto 1fr;
  align-items: center;
}

.enabled-row input {
  width: 16px;
  height: 16px;
  accent-color: #4f46e5;
}

.enabled-row em {
  color: #64748b;
  font-size: 0.78rem;
  font-style: normal;
  font-weight: 500;
}

.field input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  background: #fff;
}

.file-row {
  display: flex;
  gap: 10px;
}

.hidden-input {
  display: none;
}

.actions {
  margin-top: 16px;
}

.primary,
.secondary,
.ghost {
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

.ghost {
  background: transparent;
  color: #334155;
}

.ghost--danger {
  color: #dc2626;
}

.notice {
  color: #0f766e;
  font-size: 0.9rem;
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

.list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.list-item {
  justify-content: space-between;
  padding: 16px 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.72);
}

.mono {
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
  font-size: 0.84rem;
}

@media (max-width: 720px) {
  .card-header,
  .file-row,
  .actions,
  .list-item,
  .list-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .audio-library--bgm .audio-grid {
    grid-template-columns: 1fr;
  }

  .field--wide {
    grid-column: auto;
  }
}
</style>
