<script setup lang="ts">
import { computed, watch } from 'vue';

import { useAssetRecovery } from '../../composables/useAssetRecovery';
import type { CharacterBinding, ScriptEntry, TimbreLibraryItem } from '../../domain/project';

const props = defineProps<{
  isSaving: boolean;
  selectedVoiceDesignName: string;
  script: ScriptEntry;
  timbres: TimbreLibraryItem[];
}>();

const emit = defineEmits<{
  addCharacter: [];
  analyzeCharacterVoice: [characterId: string];
  generateCharacterVoice: [characterId: string];
  removeCharacter: [characterId: string];
  saveNow: [];
  updateAnalysis: [value: string];
  updateCharacter: [payload: { id: string; patch: Partial<CharacterBinding> }];
  updateRawScript: [value: string];
}>();

const voiceAssetKeys = computed(() =>
  props.script.data.characters.map((character) => character.voiceAssetKey)
);
const { assetStatusByKey, refreshAssetStatus } = useAssetRecovery({ statusKeys: voiceAssetKeys });

const updateCharacterField = (
  characterId: string,
  patch: Partial<CharacterBinding>
) => {
  emit('updateCharacter', { id: characterId, patch });
};

const handleVoiceFileChange = (characterId: string, voiceFile: string) => {
  const matchedTimbre = props.timbres.find((item) => item.refPath === voiceFile);
  const character = props.script.data.characters.find((item) => item.id === characterId);

  updateCharacterField(characterId, {
    voiceFile,
    voiceAssetKey: matchedTimbre?.assetKey ?? '',
    voiceDescription: matchedTimbre?.description || character?.voiceDescription || '',
    voicePromptText: matchedTimbre?.promptText || character?.voicePromptText || ''
  });
};

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

watch(
  () =>
    props.script.data.characters.map(
      (character) => `${character.id}:${character.voiceAssetKey}:${character.voiceFile}`
    ),
  () => {
    voiceAssetKeys.value.forEach((key) => {
      void refreshAssetStatus(key);
    });
  },
  { immediate: true }
);
</script>

<template>
  <article class="card">
    <header class="header">
      <div>
        <p class="eyebrow">脚本元数据</p>
        <h3 class="title">{{ props.script.name }}</h3>
      </div>
      <button type="button" class="secondary" @click="emit('saveNow')">
        {{ props.isSaving ? '正在保存...' : '立即保存草稿' }}
      </button>
    </header>

    <div class="stack">
      <label class="field">
        <span class="field-label">原始剧本</span>
        <textarea
          class="large-textarea"
          :value="props.script.data.rawScript"
          spellcheck="false"
          @input="emit('updateRawScript', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <label class="field">
        <span class="field-label">分析结果草稿</span>
        <textarea
          class="medium-textarea"
          :value="props.script.data.rawAnalysisResult"
          spellcheck="false"
          @input="emit('updateAnalysis', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </div>

    <section class="character-section">
      <header class="section-header">
        <div>
          <p class="section-kicker">角色绑定</p>
          <h4 class="section-title">基础角色清单</h4>
        </div>
        <button type="button" class="primary" @click="emit('addCharacter')">新增角色</button>
      </header>

      <div v-if="props.script.data.characters.length" class="character-list">
        <article
          v-for="character in props.script.data.characters"
          :key="character.id"
          class="character-card"
        >
          <div class="character-grid">
            <label class="field">
              <span class="field-label">角色名</span>
              <input
                :value="character.name"
                type="text"
                @input="
                  updateCharacterField(character.id, {
                    name: ($event.target as HTMLInputElement).value
                  })
                "
              />
            </label>

            <label class="field">
              <span class="field-label">绑定音色</span>
              <select
                :value="character.voiceFile"
                @change="
                  handleVoiceFileChange(
                    character.id,
                    ($event.target as HTMLSelectElement).value
                  )
                "
              >
                <option value="">未绑定</option>
                <option v-for="timbre in props.timbres" :key="timbre.id" :value="timbre.refPath">
                  {{ timbre.name }}
                </option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">角色音量</span>
              <input
                :value="character.volume"
                type="number"
                min="0"
                max="2"
                step="0.05"
                @input="
                  updateCharacterField(character.id, {
                    volume: Number(($event.target as HTMLInputElement).value || 0)
                  })
                "
              />
            </label>

            <label class="field field--wide">
              <span class="field-label">音色描述</span>
              <textarea
                class="small-textarea"
                :value="character.voiceDescription"
                spellcheck="false"
                @input="
                  updateCharacterField(character.id, {
                    voiceDescription: ($event.target as HTMLTextAreaElement).value
                  })
                "
              />
            </label>
          </div>

          <div class="character-footer">
            <div class="status-row">
              <span class="asset-pill" :class="resolveAssetStatusClass(character.voiceAssetKey)">
                {{ resolveAssetStatusLabel(character.voiceAssetKey) }}
              </span>
              <span class="asset-note">
                `voiceAssetKey`：{{ character.voiceAssetKey || '尚未绑定本地资源' }}
              </span>
            </div>
            <div class="footer-actions">
              <button
                type="button"
                class="ghost"
                @click="emit('analyzeCharacterVoice', character.id)"
              >
                {{ character.isAnalyzing ? '停止分析' : '分析音色' }}
              </button>
              <button
                type="button"
                class="ghost"
                @click="emit('generateCharacterVoice', character.id)"
              >
                {{
                  character.isGeneratingVoice
                    ? '停止生成'
                    : `${props.selectedVoiceDesignName} 生成音色`
                }}
              </button>
              <button
                type="button"
                class="ghost ghost--danger"
                @click="emit('removeCharacter', character.id)"
              >
                删除角色
              </button>
            </div>
          </div>
        </article>
      </div>
      <p v-else class="empty">当前脚本还没有角色绑定，先新增一条角色记录。</p>
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

.header,
.section-header,
.character-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header {
  margin-bottom: 18px;
}

.stack {
  display: grid;
  gap: 14px;
}

.eyebrow,
.section-kicker {
  margin: 0 0 8px;
  color: #4f46e5;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title,
.section-title {
  margin: 0;
}

.field {
  display: grid;
  gap: 8px;
}

.field-label {
  color: #475569;
  font-size: 0.92rem;
  font-weight: 700;
}

.field--wide {
  grid-column: 1 / -1;
}

.field input,
.field select,
.large-textarea,
.medium-textarea,
.small-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  background: #fff;
}

.large-textarea,
.medium-textarea,
.small-textarea {
  resize: vertical;
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
}

.large-textarea {
  min-height: 220px;
}

.medium-textarea {
  min-height: 140px;
}

.small-textarea {
  min-height: 84px;
}

.character-section {
  margin-top: 24px;
}

.character-list {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.character-card {
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 20px;
  background: #f8fafc;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.asset-note,
.empty {
  color: #64748b;
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

.character-footer {
  margin-top: 12px;
}

.footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
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
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
}

.ghost {
  background: transparent;
  color: #334155;
}

.ghost--danger {
  color: #dc2626;
}

@media (max-width: 820px) {
  .character-grid {
    grid-template-columns: 1fr;
  }

  .header,
  .section-header,
  .character-footer,
  .footer-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
