import { readonly, shallowRef } from 'vue';

import { AssetRepository } from '../services/storage/assetRepository';

interface PlayLibraryAudioOptions {
  assetKey: string;
  fallbackKey?: string;
  trimStart?: number;
  trimEnd?: number;
  volume?: number;
}

interface DrawWaveformOptions {
  assetKey: string;
  fallbackKey?: string;
  colorStart?: string;
  colorEnd?: string;
}

const assetRepository = new AssetRepository();
const audioBufferCache = new Map<string, AudioBuffer>();
const pendingBufferTasks = new Map<string, Promise<AudioBuffer | null>>();

const activeKey = shallowRef('');
const loadingKey = shallowRef('');
const playbackProgress = shallowRef(0);
const playbackDuration = shallowRef(0);
const previewError = shallowRef('');
const previewErrorKey = shallowRef('');

let audioContext: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let activeGain: GainNode | null = null;
let animationFrame = 0;
let playbackRequestId = 0;

const clampUnit = (value: number | undefined, fallback: number) => {
  const normalized = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(1, Math.max(0, normalized));
};

const getTrackKey = (assetKey: string, fallbackKey = '') => assetKey || fallbackKey;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  return audioContext;
};

const loadAssetBlob = async (assetKey: string, fallbackKey = '') => {
  const candidateKeys = Array.from(new Set([assetKey, fallbackKey].filter(Boolean)));

  for (const key of candidateKeys) {
    const blob = await assetRepository.loadAsset(key);

    if (!blob) {
      continue;
    }

    if (assetKey && key !== assetKey) {
      void assetRepository.saveAsset(assetKey, blob).catch((error) => {
        console.warn(`迁移音频资产键失败：${assetKey}`, error);
      });
    }

    return blob;
  }

  return null;
};

const loadAudioBuffer = async (assetKey: string, fallbackKey = '') => {
  const trackKey = getTrackKey(assetKey, fallbackKey);

  if (!trackKey) {
    return null;
  }

  const cached = audioBufferCache.get(trackKey);

  if (cached) {
    return cached;
  }

  const pending = pendingBufferTasks.get(trackKey);

  if (pending) {
    return pending;
  }

  const task = (async () => {
    const blob = await loadAssetBlob(assetKey, fallbackKey);

    if (!blob) {
      return null;
    }

    const decoded = await getAudioContext().decodeAudioData(await blob.arrayBuffer());
    audioBufferCache.set(trackKey, decoded);
    return decoded;
  })().finally(() => {
    pendingBufferTasks.delete(trackKey);
  });

  pendingBufferTasks.set(trackKey, task);
  return task;
};

const stopAudioNodes = () => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  if (activeSource) {
    activeSource.onended = null;

    try {
      activeSource.stop();
    } catch {
      // 音源可能已经自然结束。
    }

    activeSource.disconnect();
  }

  activeGain?.disconnect();
  activeSource = null;
  activeGain = null;
};

const stopPreview = () => {
  playbackRequestId += 1;
  stopAudioNodes();
  activeKey.value = '';
  loadingKey.value = '';
  playbackProgress.value = 0;
  playbackDuration.value = 0;
  previewError.value = '';
  previewErrorKey.value = '';
};

const playPreview = async (options: PlayLibraryAudioOptions) => {
  const trackKey = getTrackKey(options.assetKey, options.fallbackKey);

  if (!trackKey) {
    previewError.value = '音频尚未绑定本地资产。';
    previewErrorKey.value = '';
    return;
  }

  stopAudioNodes();
  const requestId = ++playbackRequestId;
  activeKey.value = '';
  loadingKey.value = trackKey;
  playbackProgress.value = 0;
  previewError.value = '';
  previewErrorKey.value = '';

  try {
    const buffer = await loadAudioBuffer(options.assetKey, options.fallbackKey);

    if (requestId !== playbackRequestId) {
      return;
    }

    if (!buffer) {
      throw new Error('本地资产缺失，请重新选择音频文件。');
    }

    const context = getAudioContext();

    if (context.state === 'suspended') {
      await context.resume();
    }

    const trimStart = Math.min(0.999, clampUnit(options.trimStart, 0));
    const trimEnd = Math.min(
      1,
      Math.max(trimStart + 0.001, clampUnit(options.trimEnd, 1))
    );
    const startOffset = buffer.duration * trimStart;
    const selectedDuration = buffer.duration * (trimEnd - trimStart);
    const source = context.createBufferSource();
    const gain = context.createGain();
    const startedAt = context.currentTime;

    source.buffer = buffer;
    const requestedVolume = Number(options.volume ?? 1);
    gain.gain.setValueAtTime(
      Number.isFinite(requestedVolume) ? Math.max(0, requestedVolume) : 1,
      startedAt
    );
    source.connect(gain).connect(context.destination);

    activeSource = source;
    activeGain = gain;
    activeKey.value = trackKey;
    loadingKey.value = '';
    playbackProgress.value = trimStart;
    playbackDuration.value = buffer.duration;

    const finish = () => {
      if (activeSource !== source) {
        return;
      }

      stopAudioNodes();
      activeKey.value = '';
      playbackProgress.value = 0;
      playbackDuration.value = 0;
    };

    source.onended = finish;
    source.start(startedAt, startOffset, selectedDuration);

    const updateProgress = () => {
      if (activeSource !== source) {
        return;
      }

      const elapsed = context.currentTime - startedAt;
      playbackProgress.value = Math.min(trimEnd, trimStart + elapsed / buffer.duration);

      if (elapsed < selectedDuration) {
        animationFrame = requestAnimationFrame(updateProgress);
      }
    };

    animationFrame = requestAnimationFrame(updateProgress);
  } catch (error) {
    if (requestId !== playbackRequestId) {
      return;
    }

    stopAudioNodes();
    activeKey.value = '';
    loadingKey.value = '';
    playbackProgress.value = 0;
    playbackDuration.value = 0;
    previewError.value = error instanceof Error ? error.message : '音频试听失败。';
    previewErrorKey.value = trackKey;
  }
};

const togglePreview = async (options: PlayLibraryAudioOptions) => {
  const trackKey = getTrackKey(options.assetKey, options.fallbackKey);

  if (trackKey && (activeKey.value === trackKey || loadingKey.value === trackKey)) {
    stopPreview();
    return;
  }

  await playPreview(options);
};

const drawWaveform = async (canvas: HTMLCanvasElement, options: DrawWaveformOptions) => {
  const buffer = await loadAudioBuffer(options.assetKey, options.fallbackKey);
  const context = canvas.getContext('2d');

  if (!context) {
    return 0;
  }

  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(240, Math.round(bounds.width * ratio));
  const height = Math.max(52, Math.round(bounds.height * ratio));

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);

  if (!buffer) {
    return 0;
  }

  const samples = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(samples.length / width));
  const center = height / 2;
  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, options.colorStart ?? '#42e8ff');
  gradient.addColorStop(1, options.colorEnd ?? '#8057ff');
  context.fillStyle = gradient;

  for (let x = 0; x < width; x += 2) {
    let peak = 0;
    const offset = x * step;
    const end = Math.min(offset + step * 2, samples.length);

    for (let index = offset; index < end; index += 1) {
      peak = Math.max(peak, Math.abs(samples[index] ?? 0));
    }

    const barHeight = Math.max(ratio, peak * height * 0.86);
    context.fillRect(x, center - barHeight / 2, Math.max(1, ratio), barHeight);
  }

  return buffer.duration;
};

const invalidateAsset = (assetKey: string, fallbackKey = '') => {
  [assetKey, fallbackKey].filter(Boolean).forEach((key) => {
    audioBufferCache.delete(key);
    pendingBufferTasks.delete(key);
  });

  if (activeKey.value === getTrackKey(assetKey, fallbackKey)) {
    stopPreview();
  }
};

export const useLibraryAudioPreview = () => ({
  activeKey: readonly(activeKey),
  loadingKey: readonly(loadingKey),
  playbackProgress: readonly(playbackProgress),
  playbackDuration: readonly(playbackDuration),
  previewError: readonly(previewError),
  previewErrorKey: readonly(previewErrorKey),
  togglePreview,
  stopPreview,
  drawWaveform,
  invalidateAsset
});
