import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
  type ComputedRef
} from 'vue';

import type {
  AudioLibraryItem,
  BgImageLine,
  CharacterBinding,
  DialogueLine,
  FilterLibraryItem,
  ScriptLine,
  TimbreLibraryItem
} from '../domain/project';
import { AssetRepository } from '../services/storage/assetRepository';
import {
  ensureReferenceAudioUploaded,
  normalizeTtsServiceBaseUrl
} from '../services/providers/ttsAssetSync';
import { ScriptWorkflowPreferenceRepository } from '../services/storage/scriptWorkflowPreferenceRepository';
import { useJobsStore } from '../stores/jobs.store';
import { useLibraryStore } from '../stores/library.store';
import { usePlaybackStore } from '../stores/playback.store';
import { useProjectStore } from '../stores/project.store';
import {
  ttsProtocolUsesReferenceText,
  type TtsConfigItem
} from '../stores/settings.defaults';

const assetRepository = new AssetRepository();
const workflowPreferenceRepository = new ScriptWorkflowPreferenceRepository();
const intensityMap: Record<string, number> = {
  微弱: 0.2,
  稍弱: 0.35,
  中等: 0.5,
  较强: 0.75,
  强烈: 1
};

const videoResolutionOptions = ['1280x720', '1920x1080', '1080x1920'] as const;

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, durationMs);
  });

const formatSrtTime = (seconds: number): string => {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = String(Math.floor(totalMilliseconds / 3_600_000)).padStart(2, '0');
  const minutes = String(Math.floor((totalMilliseconds % 3_600_000) / 60_000)).padStart(2, '0');
  const wholeSeconds = String(Math.floor((totalMilliseconds % 60_000) / 1000)).padStart(2, '0');
  const milliseconds = String(totalMilliseconds % 1000).padStart(3, '0');
  return `${hours}:${minutes}:${wholeSeconds},${milliseconds}`;
};

const splitLongSubtitleText = (text: string): string[] => {
  const processed = text.replace(/[，。,.]\s*$/, '');

  if (!processed) {
    return [];
  }

  if (processed.length <= 25) {
    return [processed];
  }

  const parts = processed
    .split(/[。.]\s*|(?<=[！？；：!?])\s*/)
    .filter((item) => item.trim().length > 0);
  const finalParts: string[] = [];

  parts.forEach((part) => {
    if (part.length <= 30) {
      finalParts.push(part);
      return;
    }

    let remaining = part;

    while (remaining.length > 0) {
      let cutIndex = 25;

      if (remaining.length <= 25) {
        cutIndex = remaining.length;
      } else {
        const lastComma = Math.max(remaining.lastIndexOf('，', 25), remaining.lastIndexOf(',', 25));
        const lastSpace = remaining.lastIndexOf(' ', 25);

        if (lastComma > 10) {
          cutIndex = lastComma;
        } else if (lastSpace > 10) {
          cutIndex = lastSpace;
        }
      }

      finalParts.push(remaining.slice(0, cutIndex).trim());

      if (remaining[cutIndex] === '，' || remaining[cutIndex] === ',') {
        remaining = remaining.slice(cutIndex + 1).trim();
      } else {
        remaining = remaining.slice(cutIndex).trim();
      }
    }
  });

  return finalParts.filter(Boolean);
};

const bufferToWave = (audioBuffer: AudioBuffer, len: number): Blob => {
  const channelCount = audioBuffer.numberOfChannels;
  const length = len * channelCount * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels: Float32Array[] = [];
  let offset = 0;
  let position = 0;

  const setUint16 = (data: number) => {
    view.setUint16(offset, data, true);
    offset += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(offset, data, true);
    offset += 4;
  };

  setUint32(0x46464952);
  setUint32(length - 8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(channelCount);
  setUint32(audioBuffer.sampleRate);
  setUint32(audioBuffer.sampleRate * 2 * channelCount);
  setUint16(channelCount * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(length - offset - 4);

  for (let index = 0; index < audioBuffer.numberOfChannels; index += 1) {
    channels.push(audioBuffer.getChannelData(index));
  }

  while (position < len) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex][position] || 0));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
    position += 1;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const makeDistortionCurve = (amount: number): Float32Array => {
  const value = Number.isFinite(amount) ? amount : 50;
  const sampleCount = 44_100;
  const curve = new Float32Array(sampleCount);
  const degrees = Math.PI / 180;

  for (let index = 0; index < sampleCount; index += 1) {
    const x = (index * 2) / sampleCount - 1;
    curve[index] = ((3 + value) * x * 20 * degrees) / (Math.PI + value * Math.abs(x));
  }

  return curve;
};

const resolveTrimRange = (line: DialogueLine): { end: number; start: number } => {
  const start = Math.max(0, Math.min(1, line.trimStart || 0));
  const rawEnd = Math.max(0, Math.min(1, line.trimEnd || 1));
  const end = rawEnd <= start ? Math.min(1, start + 0.01) : rawEnd;
  return { end, start };
};

const resolvePlayableDuration = (buffer: AudioBuffer, line: DialogueLine): number => {
  const { end, start } = resolveTrimRange(line);
  const playDuration = buffer.duration * (end - start);
  return playDuration / (line.speed || 1);
};

const isDialogueLine = (line: ScriptLine): line is DialogueLine => line.type === 'dialogue';
const isBgImageLine = (line: ScriptLine): line is BgImageLine => line.type === 'bgImage';

export const useScriptAudioRuntime = (options: {
  currentTtsConfig: ComputedRef<TtsConfigItem | null>;
  jobsStore: ReturnType<typeof useJobsStore>;
  libraryStore: ReturnType<typeof useLibraryStore>;
  playbackStore: ReturnType<typeof usePlaybackStore>;
  projectStore: ReturnType<typeof useProjectStore>;
}) => {
  const { currentTtsConfig, jobsStore, libraryStore, playbackStore, projectStore } = options;
  const isGeneratingAll = ref(false);
  const isExportingAudio = ref(false);
  const isGeneratingVideo = ref(false);
  const isSequencePlaying = ref(false);
  const exportStatus = ref('');
  const stageBackgroundUrl = ref('');
  const videoResolution = ref(workflowPreferenceRepository.getVideoResolution());

  const currentLines = computed(() => projectStore.currentScriptLines);
  const currentCharacters = computed(() => projectStore.currentCharacters);

  const audioBufferCache = new Map<string, AudioBuffer>();
  const imageUrlCache = new Map<string, string>();
  let audioContext: AudioContext | null = null;
  let dialogueSource: AudioBufferSourceNode | null = null;
  let bgmAudioNode: AudioBufferSourceNode | null = null;
  let bgmGainNode: GainNode | null = null;
  let sfxSources: AudioBufferSourceNode[] = [];
  let previewAnimationFrame: number | null = null;
  let batchAbortController: AbortController | null = null;
  let sequenceRunId = 0;

  watch(videoResolution, (value) => {
    workflowPreferenceRepository.setVideoResolution(value);
  });

  const ensureAudioContext = (): AudioContext | null => {
    if (audioContext) {
      return audioContext;
    }

    const AudioContextCtor =
      globalThis.AudioContext ??
      (
        globalThis as typeof globalThis & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextCtor) {
      window.alert('当前浏览器不支持 Web Audio API。');
      return null;
    }

    audioContext = new AudioContextCtor();
    return audioContext;
  };

  const clearPlaybackProgressAnimation = () => {
    if (previewAnimationFrame !== null) {
      cancelAnimationFrame(previewAnimationFrame);
      previewAnimationFrame = null;
    }
  };

  const revokeStageBackground = () => {
    if (stageBackgroundUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(stageBackgroundUrl.value);
    }
    stageBackgroundUrl.value = '';
  };

  const stopSfxSources = () => {
    sfxSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        //
      }
    });
    sfxSources = [];
  };

  const stopDialogueSource = () => {
    clearPlaybackProgressAnimation();

    if (!dialogueSource) {
      return;
    }

    dialogueSource.onended = null;

    try {
      dialogueSource.stop();
    } catch {
      //
    }

    dialogueSource = null;
  };

  const fadeOutAndStopBgm = () => {
    const context = ensureAudioContext();

    if (!context || !bgmAudioNode || !bgmGainNode) {
      bgmAudioNode = null;
      bgmGainNode = null;
      return;
    }

    const activeNode = bgmAudioNode;
    const activeGain = bgmGainNode;
    const currentTime = context.currentTime;
    activeGain.gain.cancelScheduledValues(currentTime);
    activeGain.gain.setValueAtTime(activeGain.gain.value, currentTime);
    activeGain.gain.linearRampToValueAtTime(0, currentTime + 2);
    globalThis.setTimeout(() => {
      try {
        activeNode.stop();
      } catch {
        //
      }
    }, 2_000);
    bgmAudioNode = null;
    bgmGainNode = null;
  };

  const stopAllAudio = (clearStage = false) => {
    stopDialogueSource();
    stopSfxSources();
    fadeOutAndStopBgm();
    playbackStore.resetRuntime();

    if (clearStage) {
      revokeStageBackground();
    }
  };

  const revokeCachedImageUrl = (assetKey: string) => {
    const cachedUrl = imageUrlCache.get(assetKey);

    if (!cachedUrl) {
      return;
    }

    URL.revokeObjectURL(cachedUrl);
    imageUrlCache.delete(assetKey);
  };

  const clearCachedAsset = (assetKey: string) => {
    audioBufferCache.delete(assetKey);
    revokeCachedImageUrl(assetKey);
  };

  const loadAssetBlob = async (assetKey: string): Promise<Blob | null> => {
    if (!assetKey) {
      return null;
    }

    return await assetRepository.loadAsset(assetKey);
  };

  const loadAudioBuffer = async (
    item: DialogueLine | AudioLibraryItem | CharacterBinding
  ): Promise<AudioBuffer | null> => {
    const rawAssetKey =
      'audioAssetKey' in item
        ? item.audioAssetKey
        : 'voiceAssetKey' in item
          ? item.voiceAssetKey
          : item.assetKey;
    const assetKey = typeof rawAssetKey === 'string' ? rawAssetKey : '';

    if (!assetKey) {
      return null;
    }

    const cached = audioBufferCache.get(assetKey);

    if (cached) {
      return cached;
    }

    const context = ensureAudioContext();

    if (!context) {
      return null;
    }

    const blob = await loadAssetBlob(assetKey);

    if (!blob) {
      return null;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
    audioBufferCache.set(assetKey, buffer);
    return buffer;
  };

  const loadImageUrl = async (assetKey: string): Promise<string> => {
    if (!assetKey) {
      return '';
    }

    const cached = imageUrlCache.get(assetKey);

    if (cached) {
      return cached;
    }

    const blob = await loadAssetBlob(assetKey);

    if (!blob) {
      return '';
    }

    const url = URL.createObjectURL(blob);
    imageUrlCache.set(assetKey, url);
    return url;
  };

  const resolveEmotionVector = (line: DialogueLine): number[] => {
    const preset = libraryStore.emotionPresets.find((item) => item.name === line.emotion);

    if (!preset?.vector) {
      return [0, 0, 0, 0, 0, 0, 0, 0];
    }

    if (libraryStore.isSystemEmotion(line.emotion)) {
      const multiplier = intensityMap[line.intensity] ?? 0.5;
      return preset.vector.map((value) => value * multiplier);
    }

    return [...preset.vector];
  };

  const resolveCharacterTimbre = (character: CharacterBinding): TimbreLibraryItem | null => {
    return (
      libraryStore.timbres.find(
        (item) => character.voiceAssetKey && item.assetKey === character.voiceAssetKey
      ) ??
      libraryStore.timbres.find((item) => item.refPath && item.refPath === character.voiceFile) ??
      null
    );
  };

  const resolveCharacterPromptText = (character: CharacterBinding): string => {
    const timbre = resolveCharacterTimbre(character);
    const timbrePromptText = timbre?.promptText?.trim();

    if (timbrePromptText) {
      return timbrePromptText;
    }

    return typeof character.voicePromptText === 'string'
      ? character.voicePromptText.trim()
      : '';
  };

  const createSynthesisPayload = (
    line: DialogueLine,
    character: CharacterBinding,
    ttsConfig: TtsConfigItem
  ): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      audio_path: character.voiceFile,
      text: line.text
    };

    if (ttsProtocolUsesReferenceText(ttsConfig.protocol)) {
      const promptText = resolveCharacterPromptText(character);

      if (!promptText) {
        throw new Error(
          `TTS 配置「${ttsConfig.name}」需要参考音频文本，请在绑定音色中填写。`
        );
      }

      payload.prompt_text = promptText;
    } else {
      payload.emo_vector = resolveEmotionVector(line);
    }

    return payload;
  };

  const readAudioResponseBlob = async (response: Response): Promise<Blob> => {
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || blob.type;

    if (blob.size === 0) {
      throw new Error('TTS 服务返回了空音频。');
    }

    if (/json|text/i.test(contentType)) {
      const text = await blob.text();
      throw new Error(`TTS 服务未返回音频：${text.slice(0, 500) || contentType}`);
    }

    return blob;
  };

  const ensureCharacterReferenceUploaded = async (
    character: CharacterBinding,
    signal?: AbortSignal
  ) => {
    const timbre = resolveCharacterTimbre(character);
    const assetKey = character.voiceAssetKey || timbre?.assetKey || '';

    if (!currentTtsConfig.value || !character.voiceFile || !assetKey) {
      return;
    }

    if (!character.voiceAssetKey) {
      character.voiceAssetKey = assetKey;
    }

    const blob = await loadAssetBlob(assetKey);

    if (!blob) {
      return;
    }

    await ensureReferenceAudioUploaded({
      baseUrl: currentTtsConfig.value.baseUrl,
      file: blob,
      fileName: character.voiceFile,
      includePromptText: ttsProtocolUsesReferenceText(currentTtsConfig.value.protocol),
      promptText: resolveCharacterPromptText(character),
      signal
    });
  };

  const hasDialogueAsset = async (line: DialogueLine): Promise<boolean> => {
    return Boolean(await loadAssetBlob(line.audioAssetKey));
  };

  const playBgm = async (bgmName: string, volume = 1) => {
    const context = ensureAudioContext();

    if (!context) {
      return;
    }

    fadeOutAndStopBgm();

    const bgmItem = libraryStore.bgmLibrary.find((item) => item.name === bgmName);

    if (!bgmItem) {
      return;
    }

    const buffer = await loadAudioBuffer(bgmItem);

    if (!buffer) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = buffer.duration * (bgmItem.trimStart ?? 0);
    source.loopEnd = buffer.duration * (bgmItem.trimEnd ?? 1);

    const gain = context.createGain();
    const finalVolume = volume * (bgmItem.volume ?? 1);
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(finalVolume, context.currentTime + 2);
    source.connect(gain).connect(context.destination);
    source.start(0, source.loopStart);

    bgmAudioNode = source;
    bgmGainNode = gain;
  };

  const applyRuntimeFilter = (
    context: BaseAudioContext,
    source: AudioBufferSourceNode,
    filterName: string
  ): AudioNode => {
    const filterConfig = libraryStore.filterLibrary.find((item) => item.name === filterName);

    if (!filterConfig) {
      return source;
    }

    if (filterConfig.type === 'distortion') {
      const waveShaper = context.createWaveShaper();
      waveShaper.curve = new Float32Array(
        Array.from(makeDistortionCurve(filterConfig.gain ?? 0))
      );
      waveShaper.oversample = '4x';
      source.connect(waveShaper);
      return waveShaper;
    }

    const biquad = context.createBiquadFilter();
    biquad.type = filterConfig.type as BiquadFilterType;
    biquad.frequency.value = filterConfig.frequency ?? 1_000;
    biquad.Q.value = filterConfig.Q ?? 1;
    if (typeof filterConfig.gain === 'number') {
      biquad.gain.value = filterConfig.gain;
    }
    source.connect(biquad);
    return biquad;
  };

  const schedulePlaybackProgress = (options: {
    duration: number;
    line: DialogueLine;
    mode: 'preview' | 'sequence';
    playDuration: number;
    startTime: number;
    trimEnd: number;
    trimStart: number;
  }) => {
    const { duration, line, mode, playDuration, startTime, trimEnd, trimStart } = options;
    const context = ensureAudioContext();

    if (!context) {
      return;
    }

    clearPlaybackProgressAnimation();

    const updateProgress = () => {
      if (mode === 'preview' && playbackStore.previewLineId !== line.id) {
        return;
      }

      if (mode === 'sequence' && playbackStore.currentSequenceLineId !== line.id) {
        return;
      }

      const elapsed = context.currentTime - startTime;

      if (elapsed >= 0) {
        const progress = trimStart + (elapsed * (line.speed || 1)) / duration;

        if (mode === 'preview') {
          playbackStore.setPreviewState(line.audioAssetKey, Math.min(progress, trimEnd), line.id);
        } else {
          playbackStore.setSequenceState(line.id, Math.min(progress, trimEnd));
        }
      }

      if (context.currentTime < startTime + playDuration / (line.speed || 1)) {
        previewAnimationFrame = requestAnimationFrame(updateProgress);
      }
    };

    previewAnimationFrame = requestAnimationFrame(updateProgress);
  };

  const playDialogueLine = async (
    line: DialogueLine,
    mode: 'preview' | 'sequence',
    stopPreviousSfx: boolean
  ): Promise<void> => {
    const context = ensureAudioContext();

    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      await context.resume();
    }

    if (mode === 'preview' && playbackStore.mode === 'preview' && playbackStore.previewLineId === line.id) {
      stopDialogueSource();
      if (stopPreviousSfx) {
        stopSfxSources();
      }
      playbackStore.resetRuntime();
      return;
    }

    stopDialogueSource();

    if (stopPreviousSfx) {
      stopSfxSources();
    }

    const dialogueBuffer = await loadAudioBuffer(line);

    if (!dialogueBuffer) {
      if (mode === 'preview') {
        window.alert('该台词尚未生成音频。');
      }
      return;
    }

    const sfxBuffers = await Promise.all(
      (line.sfx || []).map(async (cue) => {
        const item = libraryStore.sfxLibrary.find((candidate) => candidate.name === cue.name);

        if (!item) {
          return null;
        }

        const buffer = await loadAudioBuffer(item);

        if (!buffer) {
          return null;
        }

        return {
          buffer,
          cue,
          item
        };
      })
    );

    const { end: trimEnd, start: trimStart } = resolveTrimRange(line);
    const duration = dialogueBuffer.duration;
    const startOffset = duration * trimStart;
    const playDuration = duration * (trimEnd - trimStart);
    const character = currentCharacters.value.find((item) => item.name === line.role);

    const source = context.createBufferSource();
    source.buffer = dialogueBuffer;
    source.playbackRate.value = line.speed || 1;

    const gain = context.createGain();
    gain.gain.setValueAtTime(
      (line.dialogueVolume ?? 1) * (character?.volume ?? 1),
      context.currentTime
    );

    const lastNode = line.filter ? applyRuntimeFilter(context, source, line.filter) : source;
    lastNode.connect(gain).connect(context.destination);

    const now = context.currentTime + 0.05;
    dialogueSource = source;

    if (mode === 'preview') {
      playbackStore.setPreviewState(line.audioAssetKey, trimStart, line.id);
    } else {
      playbackStore.setSequenceState(line.id, trimStart);
    }

    sfxBuffers.forEach((entry) => {
      if (!entry) {
        return;
      }

      const sfxSource = context.createBufferSource();
      sfxSource.buffer = entry.buffer;
      const sfxGain = context.createGain();
      sfxGain.gain.setValueAtTime(
        (line.sfxVolume ?? 0.5) * (entry.item.volume ?? 1),
        now
      );
      sfxSource.connect(sfxGain).connect(context.destination);

      const originalDuration = dialogueBuffer.duration;
      const absStart = originalDuration * trimStart;
      const absEnd = originalDuration * trimEnd;
      const trimmedDuration = absEnd - absStart;
      const absoluteCueTime = absStart + trimmedDuration * (entry.cue.position || 0);

      if (absoluteCueTime < absStart || absoluteCueTime > absEnd) {
        return;
      }

      const relativeStart = absoluteCueTime - absStart;
      const sfxOffset = entry.buffer.duration * (entry.item.trimStart ?? 0);
      const sfxDuration =
        entry.buffer.duration * ((entry.item.trimEnd ?? 1) - (entry.item.trimStart ?? 0));

      sfxSource.start(now + relativeStart / (line.speed || 1), sfxOffset, sfxDuration);
      sfxSources.push(sfxSource);
      sfxSource.onended = () => {
        sfxSources = sfxSources.filter((item) => item !== sfxSource);
      };
    });

    await new Promise<void>((resolve) => {
      source.onended = () => {
        dialogueSource = null;
        clearPlaybackProgressAnimation();

        if (mode === 'preview' && playbackStore.previewLineId === line.id) {
          playbackStore.resetRuntime();
        }

        resolve();
      };
      source.start(now, startOffset, playDuration);
      schedulePlaybackProgress({
        duration,
        line,
        mode,
        playDuration,
        startTime: now,
        trimEnd,
        trimStart
      });
    });
  };

  const generateLineAudio = async (lineId: string, externalSignal?: AbortSignal) => {
    const line = currentLines.value.find(
      (item): item is DialogueLine => item.type === 'dialogue' && item.id === lineId
    );

    if (!line) {
      return;
    }

    if (line.isGenerating) {
      line.abortController?.abort();
      return;
    }

    if (!currentTtsConfig.value) {
      window.alert('请先在“模型配置”中选择一个 TTS 服务。');
      return;
    }

    const character = currentCharacters.value.find((item) => item.name === line.role);

    if (!character?.voiceFile) {
      window.alert(`角色「${line.role || '未命名角色'}」尚未绑定音色。`);
      return;
    }

    line.isGenerating = true;
    const controller = new AbortController();
    line.abortController = controller;
    const handleExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', handleExternalAbort);
    jobsStore.updateJob('tts', 'running', `正在生成台词「${line.role || '旁白'}」音频。`);

    try {
      await ensureCharacterReferenceUploaded(character, controller.signal);
      const response = await fetch(
        `${normalizeTtsServiceBaseUrl(currentTtsConfig.value.baseUrl)}/v2/synthesize`,
        {
          body: JSON.stringify(createSynthesisPayload(line, character, currentTtsConfig.value)),
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          signal: controller.signal
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`语音合成失败：${errorText || response.status}`);
      }

      const blob = await readAudioResponseBlob(response);
      clearCachedAsset(line.audioAssetKey);
      await assetRepository.saveAsset(line.audioAssetKey, blob);

      if (line.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(line.audioUrl);
      }

      line.audioUrl = URL.createObjectURL(blob);
      line.trimStart = 0;
      line.trimEnd = 1;
      jobsStore.updateJob('tts', 'success', `台词「${line.role}」音频生成完成。`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        jobsStore.updateJob('tts', 'idle', `已取消台词「${line.role}」生成。`);
        return;
      }

      const message = error instanceof Error ? error.message : '未知错误';
      jobsStore.updateJob('tts', 'error', message);
      window.alert(message);
      if (externalSignal) {
        throw error;
      }
    } finally {
      line.isGenerating = false;
      delete line.abortController;
      externalSignal?.removeEventListener('abort', handleExternalAbort);
    }
  };

  const clearLineAudio = async (lineId: string) => {
    const line = currentLines.value.find(
      (item): item is DialogueLine => item.type === 'dialogue' && item.id === lineId
    );

    if (!line?.audioAssetKey) {
      return;
    }

    if (line.audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(line.audioUrl);
    }

    line.audioUrl = '';
    clearCachedAsset(line.audioAssetKey);
    await assetRepository.deleteAsset(line.audioAssetKey);

    if (playbackStore.previewLineId === line.id) {
      playbackStore.resetRuntime();
      stopDialogueSource();
    }
  };

  const clearAllGeneratedAudio = async () => {
    const dialogueLines = currentLines.value.filter(isDialogueLine);
    const linesWithAudio: DialogueLine[] = [];

    for (const line of dialogueLines) {
      if (await hasDialogueAsset(line)) {
        linesWithAudio.push(line);
      }
    }

    if (linesWithAudio.length === 0) {
      window.alert('没有已生成的音频可以清除。');
      return;
    }

    if (!window.confirm(`确定清除 ${linesWithAudio.length} 条已生成音频吗？`)) {
      return;
    }

    await Promise.all(linesWithAudio.map((line) => clearLineAudio(line.id)));
  };

  const playLineAudio = async (lineId: string) => {
    const line = currentLines.value.find(
      (item): item is DialogueLine => item.type === 'dialogue' && item.id === lineId
    );

    if (!line) {
      return;
    }

    await playDialogueLine(line, 'preview', true);
  };

  const setStageBackgroundFromLine = async (line: BgImageLine | null) => {
    if (!line?.bgImageAssetKey) {
      revokeStageBackground();
      return;
    }

    const url = line.imageUrl || (await loadImageUrl(line.bgImageAssetKey));

    if (!url) {
      revokeStageBackground();
      return;
    }

    stageBackgroundUrl.value = url;
  };

  const stopSequencePlayback = (clearStage = true) => {
    isSequencePlaying.value = false;
    sequenceRunId += 1;
    stopAllAudio(clearStage);
  };

  const playSequence = async () => {
    if (isSequencePlaying.value) {
      stopSequencePlayback(true);
      return;
    }

    const lines = currentLines.value;

    if (lines.length === 0) {
      window.alert('当前脚本为空。');
      return;
    }

    const selectedIndex = lines.findIndex((line) => line.id === playbackStore.selectedLineId);
    const startIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const runId = sequenceRunId + 1;
    sequenceRunId = runId;
    stopAllAudio(false);
    isSequencePlaying.value = true;

    if (startIndex > 0) {
      const previousBgImage = [...lines.slice(0, startIndex)]
        .reverse()
        .find((line): line is BgImageLine => isBgImageLine(line));
      await setStageBackgroundFromLine(previousBgImage ?? null);

      const previousBgm = [...lines.slice(0, startIndex)]
        .reverse()
        .find((line) => line.type === 'bgm');

      if (previousBgm?.type === 'bgm' && previousBgm.action === 'play' && previousBgm.bgmName) {
        await playBgm(previousBgm.bgmName, previousBgm.volume);
      }
    } else {
      const firstBgImage = lines.find((line): line is BgImageLine => isBgImageLine(line));
      await setStageBackgroundFromLine(firstBgImage ?? null);
    }

    try {
      for (let index = startIndex; index < lines.length; index += 1) {
        if (!isSequencePlaying.value || runId !== sequenceRunId) {
          break;
        }

        const line = lines[index];

        if (line.type === 'bgm') {
          if (line.action === 'play' && line.bgmName) {
            await playBgm(line.bgmName, line.volume);
          } else {
            fadeOutAndStopBgm();
          }
          continue;
        }

        if (line.type === 'bgImage') {
          await setStageBackgroundFromLine(line);
          continue;
        }

        if (!(await hasDialogueAsset(line))) {
          continue;
        }

        await playDialogueLine(line, 'sequence', false);

        if (!isSequencePlaying.value || runId !== sequenceRunId) {
          break;
        }

        if (line.break_duration > 0) {
          await wait(line.break_duration * 1_000);
        }
      }
    } finally {
      stopSequencePlayback(true);
    }
  };

  const generateAllLines = async () => {
    if (isGeneratingAll.value) {
      batchAbortController?.abort();
      return;
    }

    const lines = currentLines.value;
    const selectedIndex = lines.findIndex((line) => line.id === playbackStore.selectedLineId);
    const startIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const targetLines: DialogueLine[] = [];

    for (const line of lines.slice(startIndex)) {
      if (!isDialogueLine(line)) {
        continue;
      }

      if (await hasDialogueAsset(line)) {
        continue;
      }

      const character = currentCharacters.value.find((item) => item.name === line.role);

      if (!character?.voiceFile) {
        window.alert(`角色「${line.role}」尚未绑定音色，无法批量生成。`);
        return;
      }

      targetLines.push(line);
    }

    if (targetLines.length === 0) {
      window.alert('没有需要生成的台词音频。');
      return;
    }

    const confirmMessage =
      startIndex > 0
        ? `即将从选中位置开始，为后续 ${targetLines.length} 条未生成台词生成音频。确定继续吗？`
        : `即将为 ${targetLines.length} 条未生成台词生成音频。确定继续吗？`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    isGeneratingAll.value = true;
    batchAbortController = new AbortController();
    jobsStore.updateJob('tts', 'running', `批量生成开始，共 ${targetLines.length} 条台词。`);
    let failedCount = 0;

    try {
      for (let index = 0; index < targetLines.length; index += 1) {
        if (batchAbortController.signal.aborted) {
          break;
        }

        const line = targetLines[index];
        jobsStore.updateJob(
          'tts',
          'running',
          `批量生成中：${index + 1}/${targetLines.length} · ${line.role || '旁白'}`
        );

        try {
          await generateLineAudio(line.id, batchAbortController.signal);
        } catch (error) {
          if (!(error instanceof Error) || error.name !== 'AbortError') {
            failedCount += 1;
          }
        }
      }

      if (batchAbortController.signal.aborted) {
        jobsStore.updateJob('tts', 'idle', '批量生成已停止。');
      } else if (failedCount > 0) {
        jobsStore.updateJob('tts', 'error', `批量生成完成，但有 ${failedCount} 条失败。`);
      } else {
        jobsStore.updateJob('tts', 'success', '批量生成完成。');
      }
    } finally {
      isGeneratingAll.value = false;
      batchAbortController = null;
    }
  };

  const uploadBackgroundImage = async (lineId: string, file: File) => {
    const line = currentLines.value.find(
      (item): item is BgImageLine => item.type === 'bgImage' && item.id === lineId
    );

    if (!line) {
      return;
    }

    clearCachedAsset(line.bgImageAssetKey);
    await assetRepository.saveAsset(line.bgImageAssetKey, file);

    if (line.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(line.imageUrl);
    }

    line.imageMimeType = file.type;
    line.imageUrl = URL.createObjectURL(file);

    if (stageBackgroundUrl.value && playbackStore.mode === 'sequence' && playbackStore.currentSequenceLineId === lineId) {
      stageBackgroundUrl.value = line.imageUrl;
    }
  };

  const copyBgImagePrompt = async (lineId: string) => {
    const line = currentLines.value.find(
      (item): item is BgImageLine => item.type === 'bgImage' && item.id === lineId
    );

    if (!line?.bgImagePrompt.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(line.bgImagePrompt);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = line.bgImagePrompt;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const exportAudio = async () => {
    const dialogueLines = currentLines.value.filter(isDialogueLine);

    if (dialogueLines.length === 0) {
      window.alert('当前脚本为空。');
      return;
    }

    const missingAudioLines: DialogueLine[] = [];

    for (const line of dialogueLines) {
      if (!(await hasDialogueAsset(line))) {
        missingAudioLines.push(line);
      }
    }

    if (
      missingAudioLines.length > 0 &&
      !window.confirm('部分台词尚未生成音频，导出时将跳过它们。确定继续吗？')
    ) {
      return;
    }

    isExportingAudio.value = true;
    jobsStore.updateJob('export', 'running', '正在离线混音并导出 WAV。');

    try {
      const assets = {
        bgm: new Map<string, AudioBuffer>(),
        dialogues: new Map<string, AudioBuffer>(),
        sfx: new Map<string, AudioBuffer>()
      };

      for (const line of dialogueLines) {
        const buffer = await loadAudioBuffer(line);

        if (buffer) {
          assets.dialogues.set(line.id, buffer);
        }
      }

      const usedSfxNames = new Set<string>();
      const usedBgmNames = new Set<string>();
      currentLines.value.forEach((line) => {
        if (line.type === 'dialogue') {
          (line.sfx || []).forEach((cue) => {
            if (cue.name) {
              usedSfxNames.add(cue.name);
            }
          });
          return;
        }

        if (line.type === 'bgm' && line.action === 'play' && line.bgmName) {
          usedBgmNames.add(line.bgmName);
        }
      });

      for (const name of usedSfxNames) {
        const item = libraryStore.sfxLibrary.find((entry) => entry.name === name);
        const buffer = item ? await loadAudioBuffer(item) : null;

        if (buffer) {
          assets.sfx.set(name, buffer);
        }
      }

      for (const name of usedBgmNames) {
        const item = libraryStore.bgmLibrary.find((entry) => entry.name === name);
        const buffer = item ? await loadAudioBuffer(item) : null;

        if (buffer) {
          assets.bgm.set(name, buffer);
        }
      }

      let currentTime = 0;
      const dialogueEvents: Array<{
        buffer: AudioBuffer;
        line: DialogueLine;
        playDuration: number;
        startTime: number;
        trimEnd: number;
        trimStart: number;
      }> = [];
      const bgmSegments: Array<{ end: number; name: string; start: number; volume: number }> = [];
      let currentBgm: { name: string; start: number; volume: number } | null = null;

      currentLines.value.forEach((line) => {
        if (line.type === 'bgm') {
          if (line.action === 'play' && line.bgmName) {
            if (currentBgm) {
              bgmSegments.push({ ...currentBgm, end: currentTime });
            }
            currentBgm = {
              name: line.bgmName,
              start: currentTime,
              volume: line.volume
            };
          } else if (currentBgm) {
            bgmSegments.push({ ...currentBgm, end: currentTime });
            currentBgm = null;
          }
          return;
        }

        if (line.type !== 'dialogue') {
          return;
        }

        const buffer = assets.dialogues.get(line.id);

        if (!buffer) {
          currentTime += line.break_duration || 0;
          return;
        }

        const { end: trimEnd, start: trimStart } = resolveTrimRange(line);
        const playDuration = buffer.duration * (trimEnd - trimStart);
        const effectiveDuration = playDuration / (line.speed || 1);
        currentTime += 0.05;
        dialogueEvents.push({
          buffer,
          line,
          playDuration,
          startTime: currentTime,
          trimEnd,
          trimStart
        });
        currentTime += effectiveDuration;
        currentTime += line.break_duration || 0;
      });

      if (currentBgm) {
        const finalizedBgm = currentBgm as {
          name: string;
          start: number;
          volume: number;
        };
        bgmSegments.push({
          end: currentTime + 2,
          name: finalizedBgm.name,
          start: finalizedBgm.start,
          volume: finalizedBgm.volume
        });
      }

      const offlineContext = new OfflineAudioContext(2, Math.ceil((currentTime + 1) * 44_100), 44_100);

      bgmSegments.forEach((segment) => {
        const buffer = assets.bgm.get(segment.name);
        const item = libraryStore.bgmLibrary.find((entry) => entry.name === segment.name);

        if (!buffer || !item) {
          return;
        }

        const source = offlineContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = buffer.duration * (item.trimStart ?? 0);
        source.loopEnd = buffer.duration * (item.trimEnd ?? 1);

        const gain = offlineContext.createGain();
        const finalVolume = segment.volume * (item.volume ?? 1);
        gain.gain.setValueAtTime(0, segment.start);
        gain.gain.linearRampToValueAtTime(finalVolume, segment.start + 2);
        gain.gain.setValueAtTime(finalVolume, Math.max(segment.start + 2, segment.end - 2));
        gain.gain.linearRampToValueAtTime(0, segment.end);
        source.connect(gain).connect(offlineContext.destination);
        source.start(segment.start, source.loopStart);
        source.stop(segment.end);
      });

      dialogueEvents.forEach((event) => {
        const source = offlineContext.createBufferSource();
        source.buffer = event.buffer;
        source.playbackRate.value = event.line.speed || 1;
        const gain = offlineContext.createGain();
        const character = currentCharacters.value.find((item) => item.name === event.line.role);
        gain.gain.value = (event.line.dialogueVolume ?? 1) * (character?.volume ?? 1);
        const lastNode = event.line.filter
          ? applyRuntimeFilter(offlineContext, source, event.line.filter)
          : source;
        lastNode.connect(gain).connect(offlineContext.destination);
        source.start(
          event.startTime,
          event.buffer.duration * event.trimStart,
          event.playDuration
        );

        (event.line.sfx || []).forEach((cue) => {
          const sfxBuffer = assets.sfx.get(cue.name);
          const sfxItem = libraryStore.sfxLibrary.find((item) => item.name === cue.name);

          if (!sfxBuffer || !sfxItem) {
            return;
          }

          const sfxSource = offlineContext.createBufferSource();
          sfxSource.buffer = sfxBuffer;
          const sfxGain = offlineContext.createGain();
          sfxGain.gain.value = (event.line.sfxVolume ?? 0.5) * (sfxItem.volume ?? 1);
          sfxSource.connect(sfxGain).connect(offlineContext.destination);
          const originalDuration = event.buffer.duration;
          const absStart = originalDuration * event.trimStart;
          const absEnd = originalDuration * event.trimEnd;
          const trimmedDuration = absEnd - absStart;
          const absSfxTime = absStart + trimmedDuration * (cue.position || 0);

          if (absSfxTime < absStart || absSfxTime > absEnd) {
            return;
          }

          sfxSource.start(
            event.startTime + (absSfxTime - absStart) / (event.line.speed || 1),
            sfxBuffer.duration * (sfxItem.trimStart ?? 0),
            sfxBuffer.duration * ((sfxItem.trimEnd ?? 1) - (sfxItem.trimStart ?? 0))
          );
        });
      });

      const renderedBuffer = await offlineContext.startRendering();
      const wavBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
      const url = URL.createObjectURL(wavBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Unitale导出音频_${Date.now()}.wav`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      jobsStore.updateJob('export', 'success', 'WAV 导出完成。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      jobsStore.updateJob('export', 'error', `WAV 导出失败：${message}`);
      window.alert(`导出 WAV 失败：${message}`);
    } finally {
      isExportingAudio.value = false;
    }
  };

  const exportSrt = async () => {
    const dialogueLines = currentLines.value.filter(isDialogueLine);

    if (dialogueLines.length === 0) {
      window.alert('当前脚本为空。');
      return;
    }

    const dialogueBuffers = new Map<string, AudioBuffer>();

    for (const line of dialogueLines) {
      const buffer = await loadAudioBuffer(line);

      if (buffer) {
        dialogueBuffers.set(line.id, buffer);
      }
    }

    let content = '';
    let currentTime = 0;
    let counter = 1;

    currentLines.value.forEach((line) => {
      if (line.type !== 'dialogue') {
        return;
      }

      const buffer = dialogueBuffers.get(line.id);

      if (!buffer) {
        currentTime += line.break_duration || 0;
        return;
      }

        const totalDuration = resolvePlayableDuration(buffer, line);
      const startTime = currentTime + 0.05;
      const segments = splitLongSubtitleText(line.text);
      const totalLength = segments.reduce((sum, item) => sum + item.length, 0);
      let segmentStartTime = startTime;

      segments.forEach((segment) => {
        const ratio = totalLength > 0 ? segment.length / totalLength : 1;
        const segmentDuration = totalDuration * ratio;
        const segmentEndTime = segmentStartTime + segmentDuration;
        content += `${counter}\n`;
        content += `${formatSrtTime(segmentStartTime)} --> ${formatSrtTime(segmentEndTime)}\n`;
        content += `${segment}\n\n`;
        counter += 1;
        segmentStartTime = segmentEndTime;
      });

      currentTime = startTime + totalDuration + (line.break_duration || 0);
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Unitale字幕_${Date.now()}.srt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    jobsStore.updateJob('export', 'success', 'SRT 导出完成。');
  };

  const generateVideo = async () => {
    const dialogueLines = currentLines.value.filter(isDialogueLine);

    if (dialogueLines.length === 0) {
      window.alert('当前脚本为空。');
      return;
    }

    const VideoEncoderCtor = (globalThis as { VideoEncoder?: typeof VideoEncoder }).VideoEncoder;
    const Mp4MuxerCtor = (globalThis as { Mp4Muxer?: any }).Mp4Muxer;

    if (!VideoEncoderCtor) {
      window.alert('当前浏览器不支持 WebCodecs API，无法导出 MP4。');
      return;
    }

    if (!Mp4MuxerCtor) {
      window.alert('缺少 Mp4Muxer 运行时，无法导出 MP4。');
      return;
    }

    isGeneratingVideo.value = true;
    exportStatus.value = '准备素材...';
    jobsStore.updateJob('export', 'running', '正在编码 MP4。');

    try {
      const dialogueBuffers = new Map<string, AudioBuffer>();

      for (const line of dialogueLines) {
        const buffer = await loadAudioBuffer(line);

        if (buffer) {
          dialogueBuffers.set(line.id, buffer);
        }
      }

      const imageLines = currentLines.value.filter(isBgImageLine);
      const bgImageCache = new Map<string, HTMLImageElement>();

      for (const line of imageLines) {
        if (!line.bgImageAssetKey) {
          continue;
        }

        const imageUrl = await loadImageUrl(line.bgImageAssetKey);

        if (!imageUrl || bgImageCache.has(imageUrl)) {
          continue;
        }

        const image = new Image();
        image.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = imageUrl;
        });
        bgImageCache.set(imageUrl, image);
      }

      let currentTime = 0;
      let currentBgUrl = '';
      let lastBgChangeTime = 0;
      const visualTimeline: Array<{ end: number; start: number; url: string }> = [];
      const firstBgImage = imageLines[0];

      if (firstBgImage?.bgImageAssetKey) {
        currentBgUrl = await loadImageUrl(firstBgImage.bgImageAssetKey);
      }

      for (const line of currentLines.value) {
        if (line.type === 'bgImage') {
          const url = line.bgImageAssetKey ? await loadImageUrl(line.bgImageAssetKey) : '';

          if (url && url !== currentBgUrl) {
            if (currentTime > lastBgChangeTime) {
              visualTimeline.push({
                end: currentTime,
                start: lastBgChangeTime,
                url: currentBgUrl
              });
            }

            currentBgUrl = url;
            lastBgChangeTime = currentTime;
          }

          continue;
        }

        if (line.type !== 'dialogue') {
          continue;
        }

        const buffer = dialogueBuffers.get(line.id);

        if (buffer) {
          currentTime += 0.05;
          currentTime += resolvePlayableDuration(buffer, line);
        }

        currentTime += line.break_duration || 0;
      }

      if (currentTime > lastBgChangeTime) {
        visualTimeline.push({
          end: currentTime,
          start: lastBgChangeTime,
          url: currentBgUrl
        });
      }

      const [rawWidth, rawHeight] = videoResolution.value.split('x').map(Number);
      const width = rawWidth % 2 === 0 ? rawWidth : rawWidth + 1;
      const height = rawHeight % 2 === 0 ? rawHeight : rawHeight + 1;
      const fps = 4;
      const frameDurationUs = Math.round(1_000_000 / fps);
      const totalDuration = currentTime + 1 + 1 / fps + 0.02;
      const muxer = new Mp4MuxerCtor.Muxer({
        fastStart: 'in-memory',
        target: new Mp4MuxerCtor.ArrayBufferTarget(),
        video: { codec: 'avc', height, width }
      });
      const encoder = new VideoEncoderCtor({
        error: (error) => {
          throw error;
        },
        output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => {
          muxer.addVideoChunk(chunk, metadata);
        }
      });

      encoder.configure({
        bitrate: 3_000_000,
        codec: 'avc1.42002a',
        framerate: fps,
        height,
        hardwareAcceleration: 'prefer-hardware',
        width
      });

      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d', { alpha: false });

      if (!context) {
        throw new Error('无法创建视频渲染画布。');
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      const drawCover = (image: CanvasImageSource) => {
        const widthRatio = width / (image as HTMLImageElement).width;
        const heightRatio = height / (image as HTMLImageElement).height;
        const scale = Math.max(widthRatio, heightRatio);
        const drawWidth = (image as HTMLImageElement).width * scale;
        const drawHeight = (image as HTMLImageElement).height * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;
        context.drawImage(image, x, y, drawWidth, drawHeight);
      };

      const segments =
        visualTimeline.length > 0
          ? visualTimeline
          : [{ end: totalDuration, start: 0, url: '' }];
      let encodedFrameCount = 0;
      const totalFrames = Math.max(
        1,
        Math.ceil(segments.reduce((sum, item) => sum + (item.end - item.start), 0) * fps)
      );

      for (const segment of segments) {
        const startUs = Math.round(segment.start * 1_000_000);
        const durationUs = Math.max(1, Math.round((segment.end - segment.start) * 1_000_000));
        const frameCount = Math.max(1, Math.ceil(durationUs / frameDurationUs));
        const image = segment.url ? bgImageCache.get(segment.url) : null;
        context.fillStyle = '#000';
        context.fillRect(0, 0, width, height);

        if (image) {
          drawCover(image);
        }

        for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
          const timestamp = startUs + frameIndex * frameDurationUs;
          const duration =
            frameIndex === frameCount - 1
              ? Math.max(1, durationUs - frameIndex * frameDurationUs)
              : frameDurationUs;
          const frame = new VideoFrame(canvas, { duration, timestamp });
          encoder.encode(frame, { keyFrame: frameIndex === 0 });
          frame.close();
          encodedFrameCount += 1;
        }

        exportStatus.value = `编码视频 ${Math.round((encodedFrameCount / totalFrames) * 100)}%`;
        await wait(0);
      }

      await encoder.flush();
      encoder.close();
      muxer.finalize();
      const mp4Buffer = muxer.target.buffer as ArrayBuffer;
      const blob = new Blob([mp4Buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Unitale导出视频_${Date.now()}.mp4`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      jobsStore.updateJob('export', 'success', 'MP4 导出完成。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      jobsStore.updateJob('export', 'error', `MP4 导出失败：${message}`);
      window.alert(`导出 MP4 失败：${message}`);
    } finally {
      isGeneratingVideo.value = false;
      exportStatus.value = '';
    }
  };

  onBeforeUnmount(() => {
    stopAllAudio(true);
    imageUrlCache.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    imageUrlCache.clear();
  });

  return {
    isGeneratingAll,
    isExportingAudio,
    isGeneratingVideo,
    isSequencePlaying,
    exportStatus,
    stageBackgroundUrl,
    videoResolution,
    videoResolutionOptions: [...videoResolutionOptions],
    generateLineAudio,
    clearLineAudio,
    clearAllGeneratedAudio,
    playLineAudio,
    playSequence,
    stopSequencePlayback,
    generateAllLines,
    uploadBackgroundImage,
    copyBgImagePrompt,
    exportAudio,
    exportSrt,
    generateVideo
  };
};
