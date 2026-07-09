<script setup lang="ts">
import { computed, ref } from 'vue';

import { useSettingsStore } from '../stores/settings.store';
import type { LlmConfigItem, TtsConfigItem } from '../stores/settings.defaults';

const settingsStore = useSettingsStore();

const llmForm = ref<Omit<LlmConfigItem, 'id'> & { id: string }>({
  id: '',
  name: '',
  baseUrl: '',
  model: '',
  key: '',
  params: ''
});

const ttsForm = ref<Omit<TtsConfigItem, 'id'> & { id: string }>({
  id: '',
  name: '',
  baseUrl: ''
});

const isEditingLlm = ref(false);
const isEditingTts = ref(false);
const llmNotice = ref('');
const ttsNotice = ref('');

const currentLlmId = computed({
  get: () => settingsStore.currentConfigId,
  set: (value: string) => settingsStore.setCurrentConfigId(value)
});

const currentTtsId = computed({
  get: () => settingsStore.currentTtsConfigId,
  set: (value: string) => settingsStore.setCurrentTtsConfigId(value)
});

const resetLlmForm = () => {
  llmForm.value = {
    id: '',
    name: '',
    baseUrl: '',
    model: '',
    key: '',
    params: ''
  };
  isEditingLlm.value = false;
};

const resetTtsForm = () => {
  ttsForm.value = {
    id: '',
    name: '',
    baseUrl: ''
  };
  isEditingTts.value = false;
};

const submitLlmConfig = () => {
  if (!llmForm.value.name || !llmForm.value.baseUrl || !llmForm.value.key) {
    llmNotice.value = '请至少填写配置名称、Base URL 和 API Key。';
    return;
  }

  settingsStore.saveLlmConfig(llmForm.value);
  llmNotice.value = isEditingLlm.value ? 'LLM 配置已更新。' : 'LLM 配置已新增。';
  resetLlmForm();
};

const submitTtsConfig = () => {
  if (!ttsForm.value.name || !ttsForm.value.baseUrl) {
    ttsNotice.value = '请至少填写配置名称和 Base URL。';
    return;
  }

  settingsStore.saveTtsConfig(ttsForm.value);
  ttsNotice.value = isEditingTts.value ? 'TTS 配置已更新。' : 'TTS 配置已新增。';
  resetTtsForm();
};

const startEditLlm = (item: LlmConfigItem) => {
  llmForm.value = { ...item };
  isEditingLlm.value = true;
};

const startEditTts = (item: TtsConfigItem) => {
  ttsForm.value = { ...item };
  isEditingTts.value = true;
};

const removeLlm = (id: string) => {
  if (!window.confirm('确定删除此 LLM 配置吗？')) {
    return;
  }

  settingsStore.deleteLlmConfig(id);
  llmNotice.value = 'LLM 配置已删除。';
};

const removeTts = (id: string) => {
  if (!window.confirm('确定删除此 TTS 配置吗？')) {
    return;
  }

  settingsStore.deleteTtsConfig(id);
  ttsNotice.value = 'TTS 配置已删除。';
};
</script>

<template>
  <section class="stack">
    <article class="card">
      <header class="card-header">
        <div>
          <p class="eyebrow">LLM 配置</p>
          <h3>OpenAI 兼容分析模型</h3>
        </div>
        <p class="note">沿用旧版 `storyforge_configs` 和 `unitale_llmConfigId` 键名。</p>
      </header>

      <div class="form-grid">
        <label class="field">
          <span>配置名称</span>
          <input v-model="llmForm.name" type="text" placeholder="例如：Gemini 分析" />
        </label>
        <label class="field">
          <span>模型名称</span>
          <input v-model="llmForm.model" type="text" placeholder="例如：gemini-2.5-flash" />
        </label>
        <label class="field field--wide">
          <span>Base URL</span>
          <input
            v-model="llmForm.baseUrl"
            type="text"
            placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
          />
        </label>
        <label class="field field--wide">
          <span>API Key</span>
          <input v-model="llmForm.key" type="password" placeholder="sk-..." />
        </label>
        <label class="field field--wide">
          <span>额外参数 JSON</span>
          <input
            v-model="llmForm.params"
            type="text"
            placeholder='例如：{"temperature":0.7,"max_tokens":2000}'
          />
        </label>
      </div>

      <div class="actions">
        <button type="button" class="primary" @click="submitLlmConfig">
          {{ isEditingLlm ? '更新 LLM 配置' : '保存 LLM 配置' }}
        </button>
        <button
          v-if="isEditingLlm"
          type="button"
          class="secondary"
          @click="resetLlmForm"
        >
          取消编辑
        </button>
        <span v-if="llmNotice" class="notice">{{ llmNotice }}</span>
      </div>

      <div class="selector-row">
        <label class="field">
          <span>当前默认分析模型</span>
          <select v-model="currentLlmId">
            <option value="">未选择</option>
            <option v-for="item in settingsStore.llmConfigs" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="settingsStore.llmConfigs.length" class="list">
        <article
          v-for="item in settingsStore.llmConfigs"
          :key="item.id"
          class="list-item"
          :class="{ 'list-item--active': item.id === settingsStore.currentConfigId }"
        >
          <div class="list-copy">
            <div class="list-title-row">
              <h4>{{ item.name }}</h4>
              <span v-if="item.id === settingsStore.currentConfigId" class="badge">当前默认</span>
            </div>
            <p>{{ item.model || '未填写模型名' }}</p>
            <p class="mono">{{ item.baseUrl }}</p>
          </div>
          <div class="list-actions">
            <button type="button" class="ghost" @click="startEditLlm(item)">编辑</button>
            <button type="button" class="ghost ghost--danger" @click="removeLlm(item.id)">
              删除
            </button>
          </div>
        </article>
      </div>
      <p v-else class="empty">还没有 LLM 配置，先从上面的表单新增一条。</p>
    </article>

    <article class="card">
      <header class="card-header">
        <div>
          <p class="eyebrow">TTS 配置</p>
          <h3>合成服务入口</h3>
        </div>
        <p class="note">沿用旧版 `storyforge_tts_configs` 和 `unitale_ttsConfigId` 键名。</p>
      </header>

      <div class="form-grid">
        <label class="field">
          <span>配置名称</span>
          <input v-model="ttsForm.name" type="text" placeholder="例如：IndexTTS 2" />
        </label>
        <label class="field field--wide">
          <span>Base URL</span>
          <input v-model="ttsForm.baseUrl" type="text" placeholder="http://127.0.0.1:8300" />
        </label>
      </div>

      <div class="actions">
        <button type="button" class="primary" @click="submitTtsConfig">
          {{ isEditingTts ? '更新 TTS 配置' : '保存 TTS 配置' }}
        </button>
        <button
          v-if="isEditingTts"
          type="button"
          class="secondary"
          @click="resetTtsForm"
        >
          取消编辑
        </button>
        <span v-if="ttsNotice" class="notice">{{ ttsNotice }}</span>
      </div>

      <div class="selector-row">
        <label class="field">
          <span>当前默认合成模型</span>
          <select v-model="currentTtsId">
            <option value="">未选择</option>
            <option v-for="item in settingsStore.ttsConfigs" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="settingsStore.ttsConfigs.length" class="list">
        <article
          v-for="item in settingsStore.ttsConfigs"
          :key="item.id"
          class="list-item"
          :class="{ 'list-item--active': item.id === settingsStore.currentTtsConfigId }"
        >
          <div class="list-copy">
            <div class="list-title-row">
              <h4>{{ item.name }}</h4>
              <span v-if="item.id === settingsStore.currentTtsConfigId" class="badge">当前默认</span>
            </div>
            <p class="mono">{{ item.baseUrl }}</p>
          </div>
          <div class="list-actions">
            <button type="button" class="ghost" @click="startEditTts(item)">编辑</button>
            <button type="button" class="ghost ghost--danger" @click="removeTts(item.id)">
              删除
            </button>
          </div>
        </article>
      </div>
      <p v-else class="empty">还没有 TTS 配置，先从上面的表单新增一条。</p>
    </article>
  </section>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 18px;
}

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

.card-header h3 {
  margin: 0;
  font-size: 1.3rem;
}

.note {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
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

.field input,
.field select {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  background: #fff;
  color: #0f172a;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
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

.selector-row {
  margin-top: 18px;
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
  padding: 16px 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.72);
}

.list-item--active {
  border-color: rgba(79, 70, 229, 0.34);
  background: rgba(224, 231, 255, 0.34);
}

.list-copy h4,
.list-copy p {
  margin: 0;
}

.list-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.list-copy p {
  color: #64748b;
}

.mono {
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
  font-size: 0.84rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.12);
  color: #4338ca;
  font-size: 0.75rem;
  font-weight: 700;
}

.list-actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.empty {
  margin: 18px 0 0;
  color: #64748b;
}

@media (max-width: 720px) {
  .card-header,
  .list-item,
  .actions {
    flex-direction: column;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .field--wide {
    grid-column: auto;
  }
}
</style>
