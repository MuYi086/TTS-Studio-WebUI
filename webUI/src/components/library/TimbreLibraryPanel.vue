<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef } from 'vue';

import { useAssetRecovery } from '../../composables/useAssetRecovery';
import { useLibraryAudioPreview } from '../../composables/useLibraryAudioPreview';
import type { TimbreLibraryItem } from '../../domain/project';
import { useLibraryStore } from '../../stores/library.store';
import LibraryAudioPreview from './LibraryAudioPreview.vue';

const libraryStore = useLibraryStore();
const timbreAssetKeys = computed(() => libraryStore.timbres.map((item) => item.assetKey));
const { assetStatusByKey } = useAssetRecovery({ statusKeys: timbreAssetKeys });

const form = ref<TimbreLibraryItem>(libraryStore.createEmptyTimbre());
const isEditing = shallowRef(false);
const notice = shallowRef('');
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInput');
const audioRevision = shallowRef(0);
const { invalidateAsset } = useLibraryAudioPreview();

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
  form.value = libraryStore.createEmptyTimbre();
  isEditing.value = false;
};

const onSelectFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  const saved = await libraryStore.saveTimbreFile(file, form.value.assetKey);
  form.value.assetKey = saved.assetKey;
  form.value.refPath = saved.refPath;
  invalidateAsset(saved.assetKey, saved.refPath);
  audioRevision.value += 1;
  await nextTick();
  notice.value = `已保存参考音频：${saved.refPath}`;
  input.value = '';
};

const submit = async () => {
  if (!form.value.name || !form.value.refPath) {
    notice.value = '请填写音色名称并选择一个参考音频文件。';
    return;
  }

  await libraryStore.saveTimbre(form.value);
  notice.value = isEditing.value ? '音色已更新。' : '音色已新增。';
  resetForm();
};

const startEdit = (item: TimbreLibraryItem) => {
  form.value = { ...item };
  isEditing.value = true;
};

const remove = async (id: string) => {
  if (!window.confirm('确定删除此音色吗？')) {
    return;
  }

  await libraryStore.deleteTimbre(id);
  notice.value = '音色已删除。';
};
</script>

<template>
  <article class="card">
    <header class="card-header">
      <div>
        <p class="eyebrow">音色资源库</p>
        <h3>参考音频与音色描述</h3>
      </div>
      <p class="note">本页已接入 `IndexedDB currentState` 和 `assets` 仓库。</p>
    </header>

    <div class="timbre-workbench">
      <section class="timbre-catalog" aria-label="音色列表">
        <div v-if="libraryStore.timbres.length" class="timbre-grid">
          <article v-for="item in libraryStore.timbres" :key="item.id" class="timbre-card">
            <div class="timbre-card-top">
              <span class="timbre-avatar">{{ item.name.slice(0, 1) }}</span>
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
              :fallback-key="item.refPath"
              :revision="audioRevision"
              compact
            />
            <p v-if="item.promptText" class="prompt-text">{{ item.promptText }}</p>
            <p class="mono">{{ item.refPath }}</p>
            <div class="timbre-card-footer">
              <span class="mono">{{ item.assetKey || '尚未生成 assetKey' }}</span>
              <div class="list-actions">
                <button type="button" class="ghost" @click="startEdit(item)">编辑</button>
                <button type="button" class="ghost ghost--danger" @click="remove(item.id)">
                  删除
                </button>
              </div>
            </div>
          </article>
        </div>
        <p v-else class="empty">还没有音色资源，先在右侧添加一条参考音频。</p>
      </section>

      <section class="timbre-editor" aria-label="音色编辑器">
        <p class="editor-kicker">音色管理</p>
        <div class="form-grid">
          <label class="field">
            <span>音色名称</span>
            <input v-model="form.name" type="text" placeholder="例如：旁白 / 少年音" />
          </label>
          <label class="field">
            <span>音色描述</span>
            <input
              v-model="form.description"
              type="text"
              placeholder="例如：低沉、冷静、适合中年男性"
            />
          </label>
          <label class="field field--wide">
            <span>参考音频文本</span>
            <textarea
              v-model="form.promptText"
              placeholder="可选：参考音频中实际说出的文字，用于 VoxCPM2 / Qwen3-TTS 等克隆模型"
            ></textarea>
          </label>
          <label class="field field--wide">
            <span>参考音频文件</span>
            <div class="file-row">
              <button type="button" class="secondary" @click="fileInputRef?.click()">
                选择文件
              </button>
              <input
                ref="fileInput"
                type="file"
                accept=".wav,.mp3"
                class="hidden-input"
                @change="onSelectFile"
              />
              <input
                v-model="form.refPath"
                type="text"
                placeholder="选择一个音频文件作为音色参考"
              />
            </div>
            <div class="status-row">
              <span class="asset-pill" :class="resolveAssetStatusClass(form.assetKey)">
                {{ resolveAssetStatusLabel(form.assetKey) }}
              </span>
              <span class="mono">{{ form.assetKey || '保存后生成 assetKey' }}</span>
            </div>
          </label>
          <div v-if="form.assetKey || form.refPath" class="field field--wide reference-preview">
            <span>参考音频试听</span>
            <LibraryAudioPreview
              :asset-key="form.assetKey"
              :fallback-key="form.refPath"
              :revision="audioRevision"
            />
          </div>
        </div>

        <div class="actions">
          <button type="button" class="primary" @click="submit">
            {{ isEditing ? '更新音色' : '保存音色' }}
          </button>
          <button v-if="isEditing" type="button" class="secondary" @click="resetForm">
            取消编辑
          </button>
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

.card-header {
  display: flex;
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.timbre-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.78fr);
  gap: 18px;
}

.timbre-catalog,
.timbre-editor {
  min-width: 0;
}

.timbre-editor {
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.56);
}

.editor-kicker {
  margin: 0 0 14px;
  color: #4f46e5;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.timbre-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.timbre-card {
  display: grid;
  gap: 12px;
  min-height: 190px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.72);
}

.timbre-card-top,
.timbre-card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.timbre-card-top .asset-pill {
  margin-left: auto;
}

.timbre-card-footer {
  justify-content: space-between;
}

.timbre-card-footer .mono {
  overflow: hidden;
  max-width: 54%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timbre-avatar {
  display: inline-grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #38bdf8, #6366f1);
  color: #fff;
  font-weight: 800;
}

.wave-preview {
  display: flex;
  align-items: center;
  gap: 3px;
  min-height: 28px;
}

.wave-preview i {
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(180deg, #22d3ee, #6366f1);
  opacity: 0.75;
}

.wave-preview i:nth-child(3n) { height: 26px; }
.wave-preview i:nth-child(4n) { height: 20px; }
.wave-preview i:nth-child(5n) { height: 9px; }

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

.reference-preview {
  padding: 12px;
  border: 1px solid rgba(104, 159, 255, 0.18);
  border-radius: 14px;
  background: rgba(2, 10, 28, 0.4);
}

.field input,
.field textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  background: #fff;
}

.field textarea {
  min-height: 82px;
  resize: vertical;
}

.file-row {
  display: flex;
  gap: 10px;
}

.hidden-input {
  display: none;
}

.actions,
.list-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
</style>
