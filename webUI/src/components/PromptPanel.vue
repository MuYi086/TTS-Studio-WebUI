<script setup lang="ts">
import { computed, ref } from 'vue';

import { useSettingsStore } from '../stores/settings.store';

const settingsStore = useSettingsStore();
const notice = ref('');

const useCustomPrompt = computed({
  get: () => settingsStore.useCustomPrompt,
  set: (value: boolean) => settingsStore.setUseCustomPrompt(value)
});

const useCustomVoicePrompt = computed({
  get: () => settingsStore.useCustomVoicePrompt,
  set: (value: boolean) => settingsStore.setUseCustomVoicePrompt(value)
});

const useCustomQwenVoiceText = computed({
  get: () => settingsStore.useCustomQwenVoiceText,
  set: (value: boolean) => settingsStore.setUseCustomQwenVoiceText(value)
});

const savePromptBundle = () => {
  settingsStore.persistPromptBundle();
  notice.value = '剧本分析 Prompt 与音色分析 Prompt 已保存。';
};

const saveVoicePrompt = () => {
  settingsStore.persistVoicePrompt();
  notice.value = '音色分析 Prompt 已保存。';
};

const resetPromptBundle = () => {
  if (!window.confirm('确定要恢复默认 Prompt 吗？')) {
    return;
  }

  settingsStore.resetPromptBundle();
  notice.value = '分析 Prompt 已恢复为默认草稿，记得根据需要再次保存。';
};

const resetVoicePrompt = () => {
  if (!window.confirm('确定要恢复默认的音色分析 Prompt 吗？')) {
    return;
  }

  settingsStore.resetVoicePrompt();
  notice.value = '音色分析 Prompt 已恢复默认并写回本地存储。';
};

const saveQwenVoiceText = () => {
  settingsStore.persistQwenVoiceText();
  notice.value = 'Qwen 参考文本模板已保存。';
};

const resetQwenVoiceText = () => {
  if (!window.confirm('确定要恢复默认文本吗？')) {
    return;
  }

  settingsStore.resetQwenVoiceText();
  notice.value = 'Qwen 参考文本已恢复为默认草稿，记得根据需要再次保存。';
};
</script>

<template>
  <section class="stack">
    <article class="card">
      <header class="card-header">
        <div>
          <p class="eyebrow">Prompt 管理</p>
          <h3>剧本分析与角色音色模板</h3>
        </div>
        <p class="note">
          本页已接入旧版本地键：`storyforge_prompt_template`、`storyforge_voice_prompt_template`。
        </p>
      </header>

      <div class="inline-toggle">
        <label class="switch-row">
          <input v-model="useCustomPrompt" type="checkbox" />
          <span>启用自定义剧本分析 Prompt</span>
        </label>
      </div>

      <textarea
        v-model="settingsStore.customPromptTemplate"
        class="large-textarea"
        :disabled="!useCustomPrompt"
        spellcheck="false"
      />
      <p class="hint">可用变量：${sfxSection}、${bgmSection}、${bgmExampleLine}、${sfxExample}、${rawScript}</p>

      <div class="actions">
        <button type="button" class="primary" @click="savePromptBundle">保存设置</button>
        <button type="button" class="secondary" @click="resetPromptBundle">恢复默认</button>
        <span v-if="notice" class="notice">{{ notice }}</span>
      </div>

      <hr class="divider" />

      <div class="sub-header">
        <div>
          <p class="eyebrow">角色音色分析</p>
          <h4>角色音色分析 Prompt</h4>
        </div>
      </div>

      <div class="inline-toggle">
        <label class="switch-row">
          <input v-model="useCustomVoicePrompt" type="checkbox" />
          <span>启用自定义音色分析 Prompt</span>
        </label>
      </div>

      <textarea
        v-model="settingsStore.customVoicePromptTemplate"
        class="medium-textarea"
        :disabled="!useCustomVoicePrompt"
        spellcheck="false"
      />
      <p class="hint">可用变量：${charName}、${rawScript}</p>

      <div class="actions">
        <button type="button" class="primary" @click="saveVoicePrompt">保存音色 Prompt</button>
        <button type="button" class="secondary" @click="resetVoicePrompt">恢复默认</button>
      </div>
    </article>

    <article class="card">
      <header class="card-header">
        <div>
          <p class="eyebrow">Qwen 模板</p>
          <h3>参考音频文本模板</h3>
        </div>
        <p class="note">
          本页已接入旧版本地键：`storyforge_qwen_voice_text_template`。
        </p>
      </header>

      <div class="inline-toggle">
        <label class="switch-row">
          <input v-model="useCustomQwenVoiceText" type="checkbox" />
          <span>启用自定义生成文本</span>
        </label>
      </div>

      <textarea
        v-model="settingsStore.customQwenVoiceTextTemplate"
        class="small-textarea"
        :disabled="!useCustomQwenVoiceText"
        spellcheck="false"
      />
      <p class="hint">可用变量：${charName}</p>

      <div class="actions">
        <button type="button" class="primary" @click="saveQwenVoiceText">保存文本模板</button>
        <button type="button" class="secondary" @click="resetQwenVoiceText">恢复默认</button>
      </div>
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

.card-header,
.sub-header {
  display: flex;
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

.card-header h3,
.sub-header h4 {
  margin: 0;
}

.note,
.hint {
  margin: 0;
  color: #64748b;
}

.inline-toggle {
  margin-bottom: 12px;
}

.switch-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #334155;
  font-weight: 600;
}

.large-textarea,
.medium-textarea,
.small-textarea {
  width: 100%;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 18px;
  resize: vertical;
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
  line-height: 1.55;
}

.large-textarea {
  min-height: 520px;
}

.medium-textarea {
  min-height: 220px;
}

.small-textarea {
  min-height: 120px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}

.primary,
.secondary {
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

.notice {
  color: #0f766e;
  font-size: 0.9rem;
}

.divider {
  margin: 24px 0;
  border: none;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

@media (max-width: 720px) {
  .card-header,
  .sub-header,
  .actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .large-textarea {
    min-height: 360px;
  }
}
</style>
