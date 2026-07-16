<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';

import type { EmotionPreset } from '../../domain/project';
import { useLibraryStore } from '../../stores/library.store';

const libraryStore = useLibraryStore();

const form = ref<EmotionPreset>(libraryStore.createEmptyEmotionPreset());
const isEditing = shallowRef(false);
const isEditorOpen = shallowRef(false);
const notice = shallowRef('');
const systemEmotionPresets = computed(() =>
  libraryStore.emotionPresets.filter((item) => libraryStore.isSystemEmotion(item.name))
);

const resetForm = () => {
  form.value = libraryStore.createEmptyEmotionPreset();
  isEditing.value = false;
  isEditorOpen.value = false;
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
  isEditorOpen.value = true;
};

const toggleEnabled = async (item: EmotionPreset) => {
  await libraryStore.saveEmotionPreset({
    ...item,
    vector: [...item.vector],
    enabled: item.enabled === false
  });
  notice.value = item.enabled === false ? '情绪预设已启用。' : '情绪预设已停用。';
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
      <div class="header-actions">
        <button type="button" class="secondary" @click="isEditorOpen = !isEditorOpen">
          {{ isEditorOpen ? '收起编辑器' : '新增自定义情绪' }}
        </button>
        <button type="button" class="secondary" @click="resetDefaults">恢复系统默认</button>
      </div>
    </header>

    <section class="system-emotion-grid" aria-label="系统情绪预设">
      <article v-for="item in systemEmotionPresets" :key="item.id" class="system-emotion-card">
        <span class="emotion-orbit" aria-hidden="true"></span>
        <strong>{{ item.name }}</strong>
        <span class="mono">[{{ item.vector.join(',') }}]</span>
      </article>
    </section>

    <section v-if="isEditorOpen" class="emotion-editor">
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
    </section>

    <div v-if="!isEditorOpen && notice" class="notice notice--standalone">{{ notice }}</div>

    <div v-if="libraryStore.customEmotionPresets.length" class="list">
      <article v-for="item in libraryStore.customEmotionPresets" :key="item.id" class="list-item">
        <div class="list-copy">
          <h4>{{ item.name }}</h4>
          <p class="mono">[{{ item.vector.join(', ') }}]</p>
        </div>
        <div class="list-actions">
          <button
            type="button"
            class="preset-state"
            :class="{ 'preset-state--off': item.enabled === false }"
            @click="toggleEnabled(item)"
          >
            {{ item.enabled === false ? '已停用' : '已启用' }}
          </button>
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
.header-actions,
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

.header-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.system-emotion-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.system-emotion-card {
  display: grid;
  gap: 7px;
  padding: 11px;
  border: 1px solid rgba(104, 159, 255, 0.18);
  border-radius: 14px;
  background: rgba(6, 15, 36, 0.7);
}

.system-emotion-card strong {
  color: var(--tts-text-secondary);
}

.emotion-orbit {
  width: 26px;
  height: 12px;
  border: 1px solid rgba(66, 232, 255, 0.5);
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(66, 232, 255, 0.16);
}

.emotion-editor {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(104, 159, 255, 0.18);
  border-radius: 16px;
  background: rgba(2, 10, 28, 0.42);
}

.notice--standalone {
  margin-top: 12px;
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

.preset-state {
  padding: 5px 9px;
  border: 1px solid rgba(50, 209, 140, 0.28);
  border-radius: 999px;
  background: rgba(50, 209, 140, 0.1);
  color: #15803d;
  font-size: 0.68rem;
  font-weight: 800;
  cursor: pointer;
}

.preset-state--off {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(148, 163, 184, 0.1);
  color: #64748b;
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

  .system-emotion-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
