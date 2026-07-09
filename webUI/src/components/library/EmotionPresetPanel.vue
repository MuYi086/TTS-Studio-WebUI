<script setup lang="ts">
import { ref } from 'vue';

import type { EmotionPreset } from '../../domain/project';
import { useLibraryStore } from '../../stores/library.store';

const libraryStore = useLibraryStore();

const form = ref<EmotionPreset>(libraryStore.createEmptyEmotionPreset());
const isEditing = ref(false);
const notice = ref('');

const resetForm = () => {
  form.value = libraryStore.createEmptyEmotionPreset();
  isEditing.value = false;
};

const submit = async () => {
  if (!form.value.name) {
    notice.value = '请填写情绪名称。';
    return;
  }

  try {
    await libraryStore.saveEmotionPreset(form.value);
    notice.value = isEditing.value ? '情绪预设已更新。' : '情绪预设已新增。';
    resetForm();
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : '保存情绪预设时发生未知错误。';
  }
};

const startEdit = (item: EmotionPreset) => {
  form.value = {
    ...item,
    vector: [...item.vector]
  };
  isEditing.value = true;
};

const remove = async (id: string) => {
  if (!window.confirm('确定删除此情绪预设吗？')) {
    return;
  }

  await libraryStore.deleteEmotionPreset(id);
  notice.value = '情绪预设已删除。';
};

const resetDefaults = async () => {
  if (!window.confirm('确定清除自定义情绪并恢复为系统默认值吗？')) {
    return;
  }

  await libraryStore.resetEmotionsToDefault();
  notice.value = '情绪预设已恢复为默认值。';
};
</script>

<template>
  <article class="card">
    <header class="card-header">
      <div>
        <p class="eyebrow">情绪预设</p>
        <h3>8 维向量管理</h3>
      </div>
      <button type="button" class="secondary" @click="resetDefaults">恢复系统默认</button>
    </header>

    <div class="form-grid">
      <label class="field field--wide">
        <span>情绪名称</span>
        <input v-model="form.name" type="text" placeholder="例如：压抑 / 希望" />
      </label>
      <label
        v-for="(value, index) in form.vector"
        :key="index"
        class="field"
      >
        <span>{{ ['高兴', '生气', '伤心', '害怕', '厌恶', '低落', '惊喜', '平静'][index] }}</span>
        <input v-model.number="form.vector[index]" type="number" min="0" max="1" step="0.1" />
      </label>
    </div>

    <div class="actions">
      <button type="button" class="primary" @click="submit">
        {{ isEditing ? '更新情绪预设' : '保存情绪预设' }}
      </button>
      <button v-if="isEditing" type="button" class="secondary" @click="resetForm">
        取消编辑
      </button>
      <span v-if="notice" class="notice">{{ notice }}</span>
    </div>

    <div v-if="libraryStore.customEmotionPresets.length" class="list">
      <article v-for="item in libraryStore.customEmotionPresets" :key="item.id" class="list-item">
        <div class="list-copy">
          <h4>{{ item.name }}</h4>
          <p class="mono">[{{ item.vector.join(', ') }}]</p>
        </div>
        <div class="list-actions">
          <button type="button" class="ghost" @click="startEdit(item)">编辑</button>
          <button type="button" class="ghost ghost--danger" @click="remove(item.id)">
            删除
          </button>
        </div>
      </article>
    </div>
    <p v-else class="empty">当前只有 8 个系统情绪，尚未新增自定义项。</p>
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
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

.mono,
.empty {
  color: #64748b;
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
}

@media (max-width: 720px) {
  .card-header,
  .actions,
  .list-item,
  .list-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
