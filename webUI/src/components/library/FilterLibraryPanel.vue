<script setup lang="ts">
import { ref } from 'vue';

import type { FilterLibraryItem } from '../../domain/project';
import { useLibraryStore } from '../../stores/library.store';

const libraryStore = useLibraryStore();

const form = ref<FilterLibraryItem>(libraryStore.createEmptyFilter());
const isEditing = ref(false);
const notice = ref('');

const resetForm = () => {
  form.value = libraryStore.createEmptyFilter();
  isEditing.value = false;
};

const submit = async () => {
  if (!form.value.name) {
    notice.value = '请填写滤波器名称。';
    return;
  }

  await libraryStore.saveFilter(form.value);
  notice.value = isEditing.value ? '滤波器已更新。' : '滤波器已新增。';
  resetForm();
};

const startEdit = (item: FilterLibraryItem) => {
  form.value = { ...item };
  isEditing.value = true;
};

const remove = async (id: string) => {
  if (!window.confirm('确定删除此滤波器吗？')) {
    return;
  }

  await libraryStore.deleteFilter(id);
  notice.value = '滤波器已删除。';
};

const resetDefaults = async () => {
  if (!window.confirm('确定恢复默认 4 个滤波器吗？')) {
    return;
  }

  await libraryStore.resetFiltersToDefault();
  notice.value = '默认滤波器已恢复。';
};
</script>

<template>
  <article class="card">
    <header class="card-header">
      <div>
        <p class="eyebrow">滤波器库</p>
        <h3>场景滤波元数据</h3>
      </div>
      <button type="button" class="secondary" @click="resetDefaults">恢复默认滤波器</button>
    </header>

    <div class="form-grid">
      <label class="field">
        <span>滤波器名称</span>
        <input v-model="form.name" type="text" placeholder="例如：电话音 / 水下" />
      </label>
      <label class="field">
        <span>滤波器类型</span>
        <select v-model="form.type">
          <option value="lowpass">lowpass</option>
          <option value="highpass">highpass</option>
          <option value="bandpass">bandpass</option>
          <option value="distortion">distortion</option>
        </select>
      </label>
      <label class="field field--wide">
        <span>滤波器描述</span>
        <input v-model="form.description" type="text" placeholder="用于后续 AI 判断适用场景" />
      </label>
      <label class="field">
        <span>频率</span>
        <input v-model.number="form.frequency" type="number" min="0" max="20000" step="10" />
      </label>
      <label class="field">
        <span>Q 值</span>
        <input v-model.number="form.Q" type="number" min="0.1" max="20" step="0.1" />
      </label>
      <label class="field">
        <span>Gain / Amount</span>
        <input v-model.number="form.gain" type="number" min="0" max="1000" step="10" />
      </label>
    </div>

    <div class="actions">
      <button type="button" class="primary" @click="submit">
        {{ isEditing ? '更新滤波器' : '保存滤波器' }}
      </button>
      <button v-if="isEditing" type="button" class="secondary" @click="resetForm">
        取消编辑
      </button>
      <span v-if="notice" class="notice">{{ notice }}</span>
    </div>

    <div v-if="libraryStore.filterLibrary.length" class="list">
      <article v-for="item in libraryStore.filterLibrary" :key="item.id" class="list-item">
        <div class="list-copy">
          <h4>{{ item.name }}</h4>
          <p>{{ item.description || '未填写描述' }}</p>
          <p class="mono">{{ item.type }} · Freq={{ item.frequency }} · Q={{ item.Q }} · Gain={{ item.gain }}</p>
        </div>
        <div class="list-actions">
          <button type="button" class="ghost" @click="startEdit(item)">编辑</button>
          <button type="button" class="ghost ghost--danger" @click="remove(item.id)">
            删除
          </button>
        </div>
      </article>
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.field input,
.field select {
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

.mono {
  color: #64748b;
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
  font-size: 0.84rem;
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
    grid-template-columns: 1fr;
  }

  .field--wide {
    grid-column: auto;
  }
}
</style>
