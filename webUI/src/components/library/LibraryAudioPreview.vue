<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue';

import { useLibraryAudioPreview } from '../../composables/useLibraryAudioPreview';

interface Props {
  assetKey: string;
  fallbackKey?: string;
  trimStart?: number;
  trimEnd?: number;
  volume?: number;
  editable?: boolean;
  compact?: boolean;
  playable?: boolean;
  externalActive?: boolean;
  externalProgress?: number;
  accent?: 'cyan' | 'violet';
  revision?: number;
}

const props = withDefaults(defineProps<Props>(), {
  fallbackKey: '',
  trimStart: 0,
  trimEnd: 1,
  volume: 1,
  editable: false,
  compact: false,
  playable: true,
  externalActive: false,
  externalProgress: 0,
  accent: 'cyan',
  revision: 0
});

const emit = defineEmits<{
  'update:trimStart': [value: number];
  'update:trimEnd': [value: number];
}>();

const waveformCanvas = useTemplateRef<HTMLCanvasElement>('waveformCanvas');
const waveformShell = useTemplateRef<HTMLDivElement>('waveformShell');
const duration = shallowRef(0);
const waveformError = shallowRef('');
const dragType = shallowRef<'start' | 'end' | ''>('');

const {
  activeKey,
  loadingKey,
  playbackProgress,
  previewError,
  previewErrorKey,
  togglePreview,
  drawWaveform
} = useLibraryAudioPreview();

const trackKey = computed(() => props.assetKey || props.fallbackKey);
const isPlaying = computed(() => Boolean(trackKey.value) && activeKey.value === trackKey.value);
const isLoading = computed(() => Boolean(trackKey.value) && loadingKey.value === trackKey.value);
const normalizedTrimStart = computed(() => Math.min(1, Math.max(0, props.trimStart)));
const normalizedTrimEnd = computed(() =>
  Math.max(normalizedTrimStart.value, Math.min(1, Math.max(0, props.trimEnd)))
);
const progressPercent = computed(() =>
  Math.min(
    100,
    Math.max(0, (props.externalActive ? props.externalProgress : playbackProgress.value) * 100)
  )
);
const elapsedSeconds = computed(() =>
  props.externalActive || isPlaying.value
    ? (props.externalActive ? props.externalProgress : playbackProgress.value) * duration.value
    : normalizedTrimStart.value * duration.value
);
const selectedDuration = computed(() =>
  Math.max(0, (normalizedTrimEnd.value - normalizedTrimStart.value) * duration.value)
);

const waveformColors = computed(() =>
  props.accent === 'violet'
    ? { colorStart: '#42e8ff', colorEnd: '#a855f7' }
    : { colorStart: '#42e8ff', colorEnd: '#1499ff' }
);

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const renderWaveform = async () => {
  await nextTick();

  if (!waveformCanvas.value || !trackKey.value) {
    duration.value = 0;
    return;
  }

  waveformError.value = '';

  try {
    duration.value = await drawWaveform(waveformCanvas.value, {
      assetKey: props.assetKey,
      fallbackKey: props.fallbackKey,
      ...waveformColors.value
    });

    if (!duration.value) {
      waveformError.value = '资产缺失';
    }
  } catch (error) {
    duration.value = 0;
    waveformError.value = error instanceof Error ? error.message : '波形读取失败';
  }
};

const toggle = () => {
  void togglePreview({
    assetKey: props.assetKey,
    fallbackKey: props.fallbackKey,
    trimStart: normalizedTrimStart.value,
    trimEnd: normalizedTrimEnd.value,
    volume: props.volume
  });
};

const updateTrimFromPointer = (clientX: number) => {
  if (!dragType.value || !waveformShell.value) {
    return;
  }

  const bounds = waveformShell.value.getBoundingClientRect();
  const nextValue = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
  const minGap = 0.01;

  if (dragType.value === 'start') {
    emit('update:trimStart', Math.min(nextValue, normalizedTrimEnd.value - minGap));
    return;
  }

  emit('update:trimEnd', Math.max(nextValue, normalizedTrimStart.value + minGap));
};

const onPointerMove = (event: PointerEvent) => {
  updateTrimFromPointer(event.clientX);
};

const stopDragging = () => {
  dragType.value = '';
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', stopDragging);
  window.removeEventListener('pointercancel', stopDragging);
};

const startDragging = (type: 'start' | 'end', event: PointerEvent) => {
  if (!props.editable) {
    return;
  }

  event.preventDefault();
  dragType.value = type;
  updateTrimFromPointer(event.clientX);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stopDragging, { once: true });
  window.addEventListener('pointercancel', stopDragging, { once: true });
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  void renderWaveform();

  if (waveformShell.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      void renderWaveform();
    });
    resizeObserver.observe(waveformShell.value);
  }
});

watch(
  () => [props.assetKey, props.fallbackKey, props.revision, props.accent],
  () => {
    void renderWaveform();
  }
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopDragging();
});
</script>

<template>
  <div
    class="library-audio-preview"
    :class="[
      `library-audio-preview--${props.accent}`,
      { 'library-audio-preview--compact': props.compact }
    ]"
  >
    <button
      v-if="props.playable"
      type="button"
      class="preview-toggle"
      :disabled="!trackKey || isLoading"
      :aria-label="isPlaying ? '停止试听' : '开始试听'"
      @click="toggle"
    >
      <span v-if="isLoading" class="loading-ring" aria-hidden="true"></span>
      <span v-else-if="isPlaying" class="pause-icon" aria-hidden="true"></span>
      <span v-else class="play-icon" aria-hidden="true"></span>
    </button>

    <div class="preview-main">
      <div ref="waveformShell" class="waveform-shell">
        <canvas ref="waveformCanvas" class="waveform-canvas"></canvas>
        <div
          class="trim-mask trim-mask--start"
          :style="{ width: `${normalizedTrimStart * 100}%` }"
        ></div>
        <div
          class="trim-mask trim-mask--end"
          :style="{ width: `${(1 - normalizedTrimEnd) * 100}%` }"
        ></div>
        <button
          v-if="props.editable"
          type="button"
          class="trim-handle trim-handle--start"
          :style="{ left: `${normalizedTrimStart * 100}%` }"
          aria-label="拖动裁剪起点"
          @pointerdown="startDragging('start', $event)"
        ></button>
        <button
          v-if="props.editable"
          type="button"
          class="trim-handle trim-handle--end"
          :style="{ left: `${normalizedTrimEnd * 100}%` }"
          aria-label="拖动裁剪终点"
          @pointerdown="startDragging('end', $event)"
        ></button>
        <span
          v-if="isPlaying || props.externalActive"
          class="playback-cursor"
          :style="{ left: `${progressPercent}%` }"
        ></span>
        <span v-if="waveformError" class="waveform-error">{{ waveformError }}</span>
      </div>

      <div class="preview-meta">
        <span>{{ formatTime(elapsedSeconds) }} / {{ formatTime(duration) }}</span>
        <span v-if="props.editable">选区 {{ formatTime(selectedDuration) }}</span>
        <span v-if="previewError && previewErrorKey === trackKey">{{ previewError }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library-audio-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.preview-toggle {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(66, 232, 255, 0.5);
  border-radius: 50%;
  background: linear-gradient(145deg, rgba(20, 153, 255, 0.36), rgba(20, 75, 176, 0.56));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 0 18px rgba(20, 153, 255, 0.2);
  color: #e9fbff;
  cursor: pointer;
  transition: border-color 180ms ease, filter 180ms ease, transform 180ms ease;
}

.library-audio-preview--violet .preview-toggle {
  border-color: rgba(168, 85, 247, 0.55);
  background: linear-gradient(145deg, rgba(20, 153, 255, 0.35), rgba(128, 87, 255, 0.62));
}

.preview-toggle:hover:not(:disabled) {
  filter: brightness(1.16);
  transform: translateY(-1px);
}

.preview-toggle:focus-visible,
.trim-handle:focus-visible {
  outline: 2px solid var(--tts-accent-cyan);
  outline-offset: 2px;
}

.preview-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.play-icon {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 9px solid currentColor;
}

.pause-icon {
  width: 10px;
  height: 12px;
  border-right: 3px solid currentColor;
  border-left: 3px solid currentColor;
}

.loading-ring {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: preview-spin 700ms linear infinite;
}

.preview-main {
  min-width: 0;
  flex: 1;
}

.waveform-shell {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 54px;
  border: 1px solid rgba(104, 159, 255, 0.22);
  border-radius: 9px;
  background:
    linear-gradient(rgba(104, 159, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(104, 159, 255, 0.06) 1px, transparent 1px),
    rgba(2, 10, 28, 0.74);
  background-size: 100% 50%, 12.5% 100%, auto;
}

.library-audio-preview--compact .waveform-shell {
  height: 40px;
}

.waveform-canvas {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0.92;
}

.trim-mask {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  background: rgba(1, 5, 17, 0.68);
}

.trim-mask--start {
  left: 0;
  border-right: 1px solid var(--tts-accent-cyan);
}

.trim-mask--end {
  right: 0;
  border-left: 1px solid #a855f7;
}

.trim-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  width: 16px;
  margin-left: -8px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  touch-action: none;
}

.trim-handle::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 7px;
  width: 2px;
  border-radius: 2px;
  background: var(--tts-accent-cyan);
  box-shadow: 0 0 8px rgba(66, 232, 255, 0.7);
  content: '';
}

.trim-handle--end::after {
  background: #a855f7;
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.7);
}

.playback-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 2px;
  margin-left: -1px;
  background: #fff;
  box-shadow: 0 0 9px rgba(66, 232, 255, 0.95);
  pointer-events: none;
}

.waveform-error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--tts-state-danger);
  font-size: 0.68rem;
  font-weight: 700;
}

.preview-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 5px;
  color: var(--tts-text-muted);
  font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
  font-size: 0.65rem;
}

@keyframes preview-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .preview-toggle { transition: none; }
  .loading-ring { animation-duration: 1.4s; }
}
</style>
