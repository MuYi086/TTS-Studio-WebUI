<script setup lang="ts">
import { nextTick, ref } from 'vue';

import type { ScriptEntry } from '../../domain/project';

const props = defineProps<{
  currentScriptId: string;
  scripts: ScriptEntry[];
}>();

const emit = defineEmits<{
  create: [];
  remove: [scriptId: string];
  rename: [payload: { id: string; name: string }];
  switch: [scriptId: string];
}>();

const editingId = ref('');
const draftName = ref('');
const inputRefs = ref<Record<string, HTMLInputElement | null>>({});

const beginRename = async (script: ScriptEntry) => {
  editingId.value = script.id;
  draftName.value = script.name;
  await nextTick();
  inputRefs.value[script.id]?.focus();
  inputRefs.value[script.id]?.select();
};

const finishRename = () => {
  if (!editingId.value) {
    return;
  }

  emit('rename', { id: editingId.value, name: draftName.value });
  editingId.value = '';
  draftName.value = '';
};
</script>

<template>
  <article class="card">
    <header class="header">
      <div>
        <p class="eyebrow">多脚本标签</p>
        <h3 class="title">脚本工作区</h3>
      </div>
      <button type="button" class="primary" @click="emit('create')">新增脚本</button>
    </header>

    <div class="tab-row">
      <article
        v-for="script in props.scripts"
        :key="script.id"
        class="script-tab"
        :class="{ 'script-tab--active': script.id === props.currentScriptId }"
        tabindex="0"
        @click="emit('switch', script.id)"
        @dblclick.stop="beginRename(script)"
        @keyup.enter="emit('switch', script.id)"
      >
        <input
          v-if="editingId === script.id"
          :ref="(element) => (inputRefs[script.id] = element as HTMLInputElement | null)"
          v-model="draftName"
          class="rename-input"
          type="text"
          @click.stop
          @blur="finishRename"
          @keyup.enter="finishRename"
        />
        <span v-else class="script-name">{{ script.name }}</span>
        <button
          type="button"
          class="remove-button"
          title="删除脚本"
          @click.stop="emit('remove', script.id)"
        >
          ×
        </button>
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

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
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

.primary {
  border: none;
  border-radius: 999px;
  padding: 10px 16px;
  background: #4f46e5;
  color: #fff;
  cursor: pointer;
  font-weight: 700;
}

.tab-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.script-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 160px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
}

.script-tab--active {
  border-color: rgba(79, 70, 229, 0.32);
  background: rgba(224, 231, 255, 0.72);
  color: #312e81;
}

.script-name {
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.rename-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-weight: 700;
  outline: none;
}

.remove-button {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
</style>
