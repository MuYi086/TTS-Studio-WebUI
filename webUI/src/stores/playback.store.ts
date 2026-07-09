import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type PlaybackMode = 'idle' | 'preview' | 'sequence';

export const usePlaybackStore = defineStore('playback', () => {
  const selectedLineId = ref('');
  const mode = ref<PlaybackMode>('idle');
  const previewAssetKey = ref('');
  const previewLineId = ref('');
  const currentSequenceLineId = ref('');
  const playbackProgress = ref(0);

  const hasSelection = computed(() => Boolean(selectedLineId.value));

  const selectLine = (lineId: string) => {
    selectedLineId.value = lineId;
  };

  const clearSelection = () => {
    selectedLineId.value = '';
  };

  const setPreviewState = (assetKey: string, progress = 0, lineId = '') => {
    mode.value = assetKey ? 'preview' : 'idle';
    previewAssetKey.value = assetKey;
    previewLineId.value = lineId;
    playbackProgress.value = progress;

    if (!assetKey) {
      currentSequenceLineId.value = '';
    }
  };

  const setSequenceState = (lineId: string, progress = 0) => {
    mode.value = lineId ? 'sequence' : 'idle';
    currentSequenceLineId.value = lineId;
    previewAssetKey.value = '';
    previewLineId.value = '';
    playbackProgress.value = progress;
  };

  const resetRuntime = () => {
    mode.value = 'idle';
    previewAssetKey.value = '';
    previewLineId.value = '';
    currentSequenceLineId.value = '';
    playbackProgress.value = 0;
  };

  return {
    selectedLineId,
    mode,
    previewAssetKey,
    previewLineId,
    currentSequenceLineId,
    playbackProgress,
    hasSelection,
    selectLine,
    clearSelection,
    setPreviewState,
    setSequenceState,
    resetRuntime
  };
});
