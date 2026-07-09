import type {
  BgImageLine,
  BgmLine,
  CharacterBinding,
  DialogueLine,
  DialogueSfxCue,
  ScriptEntry
} from './types';
import { createId } from './utils';

export const DIALOGUE_INTENSITY_OPTIONS = [
  '微弱',
  '稍弱',
  '中等',
  '较强',
  '强烈'
] as const;

export type DialogueIntensityOption = (typeof DIALOGUE_INTENSITY_OPTIONS)[number];

export const createDialogueSfxCue = (
  overrides: Partial<DialogueSfxCue> = {}
): DialogueSfxCue => ({
  name: '',
  position: 0,
  ...overrides
});

export const createCharacterBinding = (
  overrides: Partial<CharacterBinding> = {}
): CharacterBinding => ({
  id: createId('char'),
  name: '新角色',
  voiceFile: '',
  voiceAssetKey: '',
  volume: 1,
  voiceDescription: '',
  voicePromptText: '',
  ...overrides
});

export const createDialogueLine = (
  overrides: Partial<DialogueLine> = {}
): DialogueLine => {
  const id = overrides.id ?? createId('line');

  return {
    id,
    type: 'dialogue',
    role: '旁白',
    text: '',
    emotion: '平静',
    intensity: '中等',
    filter: '',
    sfx: [],
    break_duration: 0,
    trimStart: 0,
    trimEnd: 1,
    sfxVolume: 1,
    dialogueVolume: 1,
    speed: 1,
    audioAssetKey: `line_audio_${id}`,
    audioUrl: '',
    isGenerating: false,
    ...overrides
  };
};

export const createBgmLine = (overrides: Partial<BgmLine> = {}): BgmLine => ({
  id: overrides.id ?? createId('line'),
  type: 'bgm',
  action: 'play',
  volume: 1,
  bgmName: '',
  ...overrides
});

export const createBgImageLine = (
  overrides: Partial<BgImageLine> = {}
): BgImageLine => ({
  id: overrides.id ?? createId('line'),
  type: 'bgImage',
  bgImagePrompt: '',
  bgImageAssetKey: '',
  imageUrl: '',
  imageMimeType: '',
  ...overrides
});

export const createScriptEntry = (
  overrides: Partial<ScriptEntry> = {}
): ScriptEntry => ({
  id: overrides.id ?? createId('script'),
  name: overrides.name ?? '脚本 1',
  data: {
    rawScript: '',
    rawAnalysisResult: '',
    characters: [],
    scriptLines: [],
    ...overrides.data
  }
});
