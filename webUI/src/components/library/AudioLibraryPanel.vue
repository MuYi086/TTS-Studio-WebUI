<script setup lang="ts">
import { computed, ref } from 'vue';

import { useAssetRecovery } from '../../composables/useAssetRecovery';
import type { AudioLibraryItem } from '../../domain/project';
import { useLibraryStore } from '../../stores/library.store';

const props = defineProps<{
  kind: 'sfx' | 'bgm';
  title: string;
  description: string;
  eyebrow: string;
}>();

const libraryStore = useLibraryStore();
const notice = ref('');
const isEditing = ref(false);
const form = ref<AudioLibraryItem>(libraryStore.createEmptyAudioLibraryItem());
const fileInputRef = ref<HTMLInputElement | null>(null);

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
  <article class="card">
    <header class="card-header">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h3>{{ title }}</h3>
      </div>
      <p class="note">{{ description }}</p>
    </header>

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
          <button type="button" class="secondary" @click="fileInputRef?.click()">
            选择文件
          </button>
          <input
            ref="fileInputRef"
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
      <label class="field">
        <span>trimStart</span>
        <input v-model.number="form.trimStart" type="number" min="0" max="1" step="0.01" />
      </label>
      <label class="field">
        <span>trimEnd</span>
        <input v-model.number="form.trimEnd" type="number" min="0" max="1" step="0.01" />
      </label>
    </div>

    <div class="actions">
      <button type="button" class="primary" @click="submit">
        {{ isEditing ? '更新资源' : '保存资源' }}
      </button>
      <button v-if="isEditing" type="button" class="secondary" @click="resetForm">
        取消编辑
      </button>
      <span v-if="notice" class="notice">{{ notice }}</span>
    </div>

    <div v-if="items.length" class="list">
      <article v-for="item in items" :key="item.id" class="list-item">
        <div class="list-copy">
          <h4>{{ item.name }}</h4>
          <p>{{ item.description || '未填写描述' }}</p>
          <p class="mono">
            {{ item.filename }} · volume={{ item.volume }} · trim={{ item.trimStart }}~{{ item.trimEnd }}
          </p>
          <div class="status-row">
            <span class="asset-pill" :class="resolveAssetStatusClass(item.assetKey)">
              {{ resolveAssetStatusLabel(item.assetKey) }}
            </span>
            <span class="mono">{{ item.assetKey || '尚未生成 assetKey' }}</span>
          </div>
        </div>
        <div class="list-actions">
          <button type="button" class="ghost" @click="startEdit(item)">编辑</button>
          <button type="button" class="ghost ghost--danger" @click="remove(item.id)">
            删除
          </button>
        </div>
      </article>
    </div>
    <p v-else class="empty">还没有资源项，先从上面的表单新增一条。</p>
  </article>
</template>

<style scoped>
.card {
  padding: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
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

  .field--wide {
    grid-column: auto;
  }
}
</style>
