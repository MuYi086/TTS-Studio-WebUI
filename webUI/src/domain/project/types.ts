import type {
  PROJECT_KIND,
  PROJECT_SCHEMA_VERSION,
  PROJECT_VERSION_LABEL
} from './constants';

export interface NamedEntity {
  [key: string]: unknown;
  id: string;
  name: string;
}

export interface AudioLibraryItem extends NamedEntity {
  description: string;
  filename: string;
  assetKey: string;
  trimStart: number;
  trimEnd: number;
  volume: number;
  enabled: boolean;
}

export interface TimbreLibraryItem extends NamedEntity {
  description: string;
  promptText: string;
  refPath: string;
  assetKey: string;
}

export interface FilterLibraryItem extends NamedEntity {
  description: string;
  type: string;
  frequency?: number;
  Q?: number;
  gain?: number;
  enabled?: boolean;
}

export interface EmotionPreset extends NamedEntity {
  vector: number[];
  enabled?: boolean;
}

export interface CharacterBinding extends NamedEntity {
  voiceFile: string;
  voiceAssetKey: string;
  volume: number;
  voiceDescription: string;
  voicePromptText?: string;
  isAnalyzing?: boolean;
  isGeneratingVoice?: boolean;
  abortController?: AbortController | null;
}

export interface DialogueSfxCue {
  name: string;
  position: number;
}

export interface DialogueLine {
  [key: string]: unknown;
  id: string;
  type: 'dialogue';
  role: string;
  text: string;
  emotion: string;
  intensity: string;
  filter: string;
  sfx: DialogueSfxCue[];
  break_duration: number;
  trimStart: number;
  trimEnd: number;
  sfxVolume: number;
  dialogueVolume: number;
  speed: number;
  audioAssetKey: string;
  audioUrl: string;
  isGenerating: boolean;
  abortController?: AbortController | null;
}

export interface BgmLine {
  [key: string]: unknown;
  id: string;
  type: 'bgm';
  action: 'play' | 'stop' | string;
  volume: number;
  bgmName: string;
}

export interface BgImageLine {
  [key: string]: unknown;
  id: string;
  type: 'bgImage';
  bgImagePrompt: string;
  bgImageAssetKey: string;
  imageUrl: string;
  imageMimeType: string;
}

export type ScriptLine = DialogueLine | BgmLine | BgImageLine;

export interface ScriptEntryData {
  rawScript: string;
  rawAnalysisResult: string;
  characters: CharacterBinding[];
  scriptLines: ScriptLine[];
}

export interface ScriptEntry {
  id: string;
  name: string;
  data: ScriptEntryData;
}

export interface ProjectLibraries {
  sfx: AudioLibraryItem[];
  bgm: AudioLibraryItem[];
  timbres: TimbreLibraryItem[];
  filters: FilterLibraryItem[];
  emotions: EmotionPreset[];
}

export interface ProjectState {
  currentScriptId: string;
  scriptList: ScriptEntry[];
}

export interface ProjectEnvelope {
  kind: typeof PROJECT_KIND;
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  version: typeof PROJECT_VERSION_LABEL;
  savedAt: number;
  libraries: ProjectLibraries;
  project: ProjectState;
}

export interface VoiceLookup {
  byPath: Map<string, string>;
  byName: Map<string, TimbreLibraryItem>;
}

export interface NormalizeLookupOptions {
  timbres?: TimbreLibraryItem[];
  voiceKeyByPath?: Map<string, string>;
  voiceKeyByName?: Map<string, TimbreLibraryItem>;
  fallbackCharacters?: unknown[];
  defaultId?: string;
  defaultName?: string;
  rawScript?: string;
  rawAnalysisResult?: string;
}

export type JsonObject = Record<string, unknown>;
