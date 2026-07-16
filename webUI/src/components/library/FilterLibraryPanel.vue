<script setup lang="ts">
import { ref, shallowRef } from 'vue';

import type { FilterLibraryItem } from '../../domain/project';
import { useLibraryStore } from '../../stores/library.store';

const libraryStore = useLibraryStore();

const form = ref<FilterLibraryItem>(libraryStore.createEmptyFilter());
const isEditing = shallowRef(false);
const isEditorOpen = shallowRef(false);
const notice = shallowRef('');

const resetForm = () => {
  form.value = libraryStore.createEmptyFilter();
  isEditing.value = false;
  isEditorOpen.value = false;
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
  isEditorOpen.value = true;
};

const toggleEnabled = async (item: FilterLibraryItem) => {
  await libraryStore.saveFilter({
    ...item,
    enabled: item.enabled === false
  });
  notice.value = item.enabled === false ? '滤波器已启用。' : '滤波器已停用。';
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
  <article class="card filter-library">
    <header class="card-header">
      <div>
        <p class="eyebrow">滤波器库</p>
        <h3>音频滤波器管理</h3>
      </div>
      <div class="header-actions">
        <button type="button" class="secondary" @click="isEditorOpen = !isEditorOpen">
          {{ isEditorOpen ? '收起编辑器' : '新增滤波器' }}
        </button>
        <button type="button" class="secondary" @click="resetDefaults">恢复默认滤波器</button>
      </div>
    </header>

    <section class="filter-analysis" aria-hidden="true">
      <div class="analysis-heading">
        <span>频谱响应预览</span>
        <span>20 Hz — 20 kHz</span>
      </div>
      <svg viewBox="0 0 560 140" preserveAspectRatio="none" role="presentation">
        <defs>
          <linearGradient id="filterCurve" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#22d3ee" />
            <stop offset="0.55" stop-color="#3b82f6" />
            <stop offset="1" stop-color="#a855f7" />
          </linearGradient>
        </defs>
        <path class="analysis-grid" d="M0 28H560M0 70H560M0 112H560M70 0V140M180 0V140M300 0V140M420 0V140M520 0V140" />
        <path class="analysis-fill" d="M0 92 C60 104 92 58 148 70 S246 100 305 57 S416 44 476 72 S532 88 560 50 L560 140 L0 140Z" />
        <path class="analysis-line" d="M0 92 C60 104 92 58 148 70 S246 100 305 57 S416 44 476 72 S532 88 560 50" />
      </svg>
    </section>

    <section class="filter-catalog" aria-label="滤波器预设">
      <article v-for="item in libraryStore.filterLibrary" :key="item.id" class="filter-item">
        <div class="filter-item-heading">
          <span class="filter-icon">⌁</span>
          <div class="list-copy">
            <h4>{{ item.name }}</h4>
            <p>{{ item.description || '未填写描述' }}</p>
          </div>
          <span class="filter-type">{{ item.type }}</span>
        </div>
        <div class="filter-stat-grid">
          <span><b>{{ item.frequency ?? 0 }}</b>Hz</span>
          <span><b>{{ item.Q ?? 0 }}</b> Q</span>
          <span><b>{{ item.gain ?? 0 }}</b> Gain</span>
        </div>
        <div class="filter-item-footer">
          <button
            type="button"
            :class="['filter-state', { 'filter-state--off': item.enabled === false }]"
            @click="toggleEnabled(item)"
          >
            {{ item.enabled === false ? '已停用' : '已启用' }}
          </button>
          <div class="list-actions">
            <button type="button" class="ghost" @click="startEdit(item)">编辑</button>
            <button type="button" class="ghost ghost--danger" @click="remove(item.id)">删除</button>
          </div>
        </div>
      </article>
    </section>

    <section v-if="isEditorOpen" class="filter-editor" aria-label="滤波器编辑器">
      <p class="editor-kicker">{{ isEditing ? '正在编辑预设' : '新建滤波器预设' }}</p>
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
        <label class="field field--wide enabled-row">
          <span>预设状态</span>
          <input v-model="form.enabled" type="checkbox" />
          <em>{{ form.enabled ? '允许脚本分析使用此预设' : '暂不参与脚本分析' }}</em>
        </label>
      </div>

      <div class="actions">
        <button type="button" class="primary" @click="submit">
          {{ isEditing ? '更新滤波器' : '保存滤波器' }}
        </button>
        <button v-if="isEditing" type="button" class="secondary" @click="resetForm">取消编辑</button>
        <span v-if="notice" class="notice">{{ notice }}</span>
      </div>
    </section>
  </article>
</template>

<style scoped>
.card {
  padding: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
}

.filter-library {
  display: grid;
  gap: 14px;
}

.filter-analysis,
.filter-editor {
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.46);
}

.analysis-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 700;
}

.filter-analysis svg {
  display: block;
  width: 100%;
  height: 92px;
  margin-top: 8px;
}

.analysis-grid {
  stroke: rgba(100, 116, 139, 0.2);
  stroke-width: 1;
}

.analysis-fill {
  fill: rgba(56, 189, 248, 0.08);
}

.analysis-line {
  fill: none;
  stroke: url(#filterCurve);
  stroke-width: 3;
}

.filter-catalog {
  display: grid;
  gap: 10px;
}

.filter-item {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.7);
}

.filter-item-heading,
.filter-item-footer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-item-footer {
  justify-content: space-between;
}

.filter-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(56, 189, 248, 0.34);
  border-radius: 10px;
  background: rgba(56, 189, 248, 0.1);
  color: #0891b2;
  font-size: 1.1rem;
  font-weight: 800;
}

.filter-type,
.filter-state {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
  font-size: 0.68rem;
  font-weight: 700;
}

.filter-type {
  margin-left: auto;
}

.filter-state {
  background: rgba(34, 197, 94, 0.12);
  border: 0;
  color: #15803d;
  cursor: pointer;
  font-family: inherit;
}

.filter-state--off {
  background: rgba(148, 163, 184, 0.16);
  color: #64748b;
}

.filter-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.filter-stat-grid span {
  padding: 7px 5px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.08);
  color: #64748b;
  font-size: 0.68rem;
  text-align: center;
}

.filter-stat-grid b {
  margin-right: 2px;
  color: #334155;
}

.filter-editor {
  margin-top: 2px;
}

.editor-kicker {
  margin: 0 0 12px;
  color: #4f46e5;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
