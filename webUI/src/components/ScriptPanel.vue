<script setup lang="ts">
import { computed } from 'vue';

import { useScriptAiWorkflow } from '../composables/useScriptAiWorkflow';
import { useScriptAudioRuntime } from '../composables/useScriptAudioRuntime';
import ScriptLineEditorPanel from './script/ScriptLineEditorPanel.vue';
import ScriptMetadataPanel from './script/ScriptMetadataPanel.vue';
import ScriptRuntimeStatusPanel from './script/ScriptRuntimeStatusPanel.vue';
import ScriptTabsBar from './script/ScriptTabsBar.vue';
import ScriptWorkflowPanel from './script/ScriptWorkflowPanel.vue';
import type { CharacterBinding, ScriptLine } from '../domain/project';
import { useJobsStore } from '../stores/jobs.store';
import { useLibraryStore } from '../stores/library.store';
import { usePlaybackStore } from '../stores/playback.store';
import { useProjectStore } from '../stores/project.store';
import { useSettingsStore } from '../stores/settings.store';

const jobsStore = useJobsStore();
const libraryStore = useLibraryStore();
const playbackStore = usePlaybackStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const aiWorkflow = useScriptAiWorkflow({
  jobsStore,
  libraryStore,
  projectStore,
  settingsStore
});
const audioRuntime = useScriptAudioRuntime({
  currentTtsConfig: aiWorkflow.currentTtsConfig,
  jobsStore,
  libraryStore,
  playbackStore,
  projectStore
});

const currentScript = computed(() => projectStore.currentScript);
const activePlaybackLineId = computed(() =>
  playbackStore.mode === 'preview'
    ? playbackStore.previewLineId
    : playbackStore.mode === 'sequence'
      ? playbackStore.currentSequenceLineId
      : ''
);
const emotionNames = computed(() =>
  libraryStore.emotionPresets
    .filter((item) => item.enabled !== false)
    .map((item) => item.name)
);
const filterNames = computed(() =>
  libraryStore.filterLibrary
    .filter((item) => item.enabled !== false)
    .map((item) => item.name)
);
const sfxNames = computed(() =>
  libraryStore.sfxLibrary
    .filter((item) => item.enabled !== false)
    .map((item) => item.name)
);
const bgmNames = computed(() =>
  libraryStore.bgmLibrary
    .filter((item) => item.enabled !== false)
    .map((item) => item.name)
);

const handleRemoveScript = (scriptId: string) => {
  if (projectStore.projectState.scriptList.length <= 1) {
    window.alert('至少保留一个脚本。');
    return;
  }

  if (!window.confirm('确定删除此脚本吗？')) {
    return;
  }

  if (projectStore.deleteScript(scriptId)) {
    playbackStore.clearSelection();
    playbackStore.resetRuntime();
    audioRuntime.stopSequencePlayback(true);
  }
};

const handleRemoveCharacter = (characterId: string) => {
  if (!window.confirm('确定删除此角色吗？')) {
    return;
  }

  projectStore.removeCharacter(characterId);
};

const handleRemoveLine = (lineId: string) => {
  if (!window.confirm('确定删除这个脚本块吗？')) {
    return;
  }

  projectStore.removeScriptLine(lineId);

  if (playbackStore.selectedLineId === lineId) {
    playbackStore.clearSelection();
  }
};

const handleUpdateCharacter = (payload: {
  id: string;
  patch: Partial<CharacterBinding>;
}) => {
  projectStore.updateCharacter(payload.id, payload.patch);
};

const handleUpdateLine = (payload: { lineId: string; patch: Partial<ScriptLine> }) => {
  projectStore.updateScriptLine(payload.lineId, payload.patch);
};

const handleAddDialogue = () => {
  const lineId = projectStore.addDialogueLine(playbackStore.selectedLineId);
  playbackStore.selectLine(lineId);
};

const handleAddBgm = () => {
  const lineId = projectStore.addBgmLine(playbackStore.selectedLineId, bgmNames.value[0] ?? '');
  playbackStore.selectLine(lineId);
};

const handleAddBgImage = () => {
  const lineId = projectStore.addBgImageLine(playbackStore.selectedLineId);
  playbackStore.selectLine(lineId);
};

const handleCreateScript = () => {
  const nextScriptId = projectStore.addScript();
  playbackStore.clearSelection();
  playbackStore.resetRuntime();
  audioRuntime.stopSequencePlayback(true);
  projectStore.setCurrentScriptId(nextScriptId);
};

const handleRenameScript = (payload: { id: string; name: string }) => {
  projectStore.renameScript(payload.id, payload.name);
};

const handleSwitchScript = (scriptId: string) => {
  audioRuntime.stopSequencePlayback(true);
  projectStore.setCurrentScriptId(scriptId);
  playbackStore.clearSelection();
  playbackStore.resetRuntime();
};

const handleMoveLine = (payload: { direction: 'up' | 'down'; lineId: string }) => {
  projectStore.moveScriptLine(payload.lineId, payload.direction);
};

const handleUpdateBgImageCount = (value: number) => {
  aiWorkflow.bgImageCount.value = Math.max(0, value);
};

const handleUpdateSelectedVoiceDesignUrl = (value: string) => {
  aiWorkflow.selectedVoiceDesignUrl.value = value;
};

const handleUpdateVideoResolution = (value: string) => {
  audioRuntime.videoResolution.value = value;
};
</script>

<template>
  <section v-if="currentScript" class="stack">
    <ScriptTabsBar
      :current-script-id="projectStore.projectState.currentScriptId"
      :scripts="projectStore.projectState.scriptList"
      @create="handleCreateScript"
      @remove="handleRemoveScript"
      @rename="handleRenameScript"
      @switch="handleSwitchScript"
    />

    <div class="top-grid">
      <ScriptMetadataPanel
        :is-saving="projectStore.isSaving"
        :selected-voice-design-name="aiWorkflow.selectedVoiceDesignName.value"
        :script="currentScript"
        :timbres="libraryStore.timbres"
        @add-character="projectStore.addCharacter"
        @analyze-character-voice="aiWorkflow.analyzeCharacterVoice"
        @generate-character-voice="aiWorkflow.generateCharacterVoice"
        @remove-character="handleRemoveCharacter"
        @save-now="projectStore.persistProjectNow"
        @update-analysis="projectStore.updateRawAnalysisResult"
        @update-character="handleUpdateCharacter"
        @update-raw-script="projectStore.updateRawScript"
      />

      <ScriptRuntimeStatusPanel
        :current-line-count="projectStore.currentScriptLines.length"
        :current-script-name="currentScript.name"
        :is-saving-project="projectStore.isSaving"
        :job-list="jobsStore.jobList"
        :playback-mode="playbackStore.mode"
        :preview-asset-key="playbackStore.previewAssetKey"
        :selected-line-id="playbackStore.selectedLineId"
      />
    </div>

    <ScriptWorkflowPanel
      :bg-image-count="aiWorkflow.bgImageCount.value"
      :export-status="audioRuntime.exportStatus.value"
      :is-analyzing-script="aiWorkflow.isAnalyzingScript.value"
      :is-exporting-audio="audioRuntime.isExportingAudio.value"
      :is-generating-all="audioRuntime.isGeneratingAll.value"
      :is-generating-video="audioRuntime.isGeneratingVideo.value"
      :is-sequence-playing="audioRuntime.isSequencePlaying.value"
      :selected-line-id="playbackStore.selectedLineId"
      :selected-voice-design-url="aiWorkflow.selectedVoiceDesignUrl.value"
      :stage-background-url="audioRuntime.stageBackgroundUrl.value"
      :video-resolution="audioRuntime.videoResolution.value"
      :video-resolution-options="audioRuntime.videoResolutionOptions"
      :voice-designs="aiWorkflow.voiceDesigns.value"
      @analyze-script="aiWorkflow.analyzeScript"
      @clear-all-audio="audioRuntime.clearAllGeneratedAudio"
      @export-audio="audioRuntime.exportAudio"
      @export-srt="audioRuntime.exportSrt"
      @generate-all-lines="audioRuntime.generateAllLines"
      @generate-video="audioRuntime.generateVideo"
      @play-sequence="audioRuntime.playSequence"
      @sync-timbres="aiWorkflow.syncTimbresWithServer"
      @update-bg-image-count="handleUpdateBgImageCount"
      @update-selected-voice-design-url="handleUpdateSelectedVoiceDesignUrl"
      @update-video-resolution="handleUpdateVideoResolution"
    />

    <article class="summary-card">
      <div class="summary-metric">
        <span class="summary-label">角色</span>
        <strong>{{ projectStore.currentCharacters.length }}</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-label">Dialogue</span>
        <strong>{{ projectStore.lineTypeCounts.dialogue }}</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-label">BGM</span>
        <strong>{{ projectStore.lineTypeCounts.bgm }}</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-label">bgImage</span>
        <strong>{{ projectStore.lineTypeCounts.bgImage }}</strong>
      </div>
    </article>

    <ScriptLineEditorPanel
      :active-playback-line-id="activePlaybackLineId"
      :available-roles="projectStore.availableRoles"
      :bgm-names="bgmNames"
      :emotion-names="emotionNames"
      :filter-names="filterNames"
      :lines="projectStore.currentScriptLines"
      :playback-mode="playbackStore.mode"
      :playback-progress="playbackStore.playbackProgress"
      :selected-line-id="playbackStore.selectedLineId"
      :sfx-names="sfxNames"
      @add-bg-image="handleAddBgImage"
      @add-bgm="handleAddBgm"
      @add-dialogue="handleAddDialogue"
      @clear-line-audio="audioRuntime.clearLineAudio"
      @copy-bg-image-prompt="audioRuntime.copyBgImagePrompt"
      @generate-line-audio="audioRuntime.generateLineAudio"
      @move-line="handleMoveLine"
      @play-line-audio="audioRuntime.playLineAudio"
      @remove-line="handleRemoveLine"
      @select-line="playbackStore.selectLine"
      @upload-bg-image="audioRuntime.uploadBackgroundImage($event.lineId, $event.file)"
      @update-line="handleUpdateLine"
    />
  </section>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 18px;
}

.top-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
  gap: 18px;
  align-items: start;
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(79, 70, 229, 0.06), transparent 48%),
    rgba(255, 255, 255, 0.94);
}

.summary-metric {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.96);
}

.summary-label {
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 700;
}

.summary-metric strong {
  color: #0f172a;
  font-size: 1.5rem;
}

@media (max-width: 1100px) {
  .top-grid,
  .summary-card {
    grid-template-columns: 1fr;
  }
}
</style>
