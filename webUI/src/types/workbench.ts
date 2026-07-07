import type { ComputedRef, Ref } from 'vue'

export type WorkbenchTab = 'config' | 'timbres' | 'sfx' | 'script' | 'prompt'

export interface LlmConfig {
  id: string
  name: string
  baseUrl: string
  model: string
  key: string
  params: string
}

export interface TtsConfig {
  id: string
  name: string
  baseUrl: string
}

export interface Character {
  id: string
  name: string
  voiceFile: string
  volume?: number
  voiceDescription?: string
  isAnalyzing?: boolean
  isGeneratingVoice?: boolean
  abortController?: AbortController
}

export interface Timbre {
  id: string
  name: string
  description: string
  refPath: string
}

export interface EmotionPreset {
  id: string
  name: string
  vector: number[]
  enabled?: boolean
}

export interface AudioAsset {
  id: string
  name: string
  description: string
  filename: string
  trimStart?: number
  trimEnd?: number
  volume?: number
  enabled?: boolean
}

export interface FilterConfig {
  id: string
  name: string
  description: string
  type: BiquadFilterType | 'distortion'
  frequency: number
  Q: number
  gain: number
  enabled?: boolean
}

export interface LineSfx {
  name: string
  position: number
}

export interface BaseScriptLine {
  id: string
  type: string
}

export interface DialogueLine extends BaseScriptLine {
  type: 'dialogue'
  role: string
  emotion: string
  intensity: string
  filter: string
  text: string
  trimStart: number
  trimEnd: number
  sfx: LineSfx[]
  break_duration: number
  sfxVolume: number
  dialogueVolume: number
  speed: number
  audioUrl: string
  isGenerating: boolean
  abortController?: AbortController
}

export interface BgmLine extends BaseScriptLine {
  type: 'bgm'
  action: 'play' | 'stop'
  volume: number
  bgmName: string
}

export interface BgImageLine extends BaseScriptLine {
  type: 'bgImage'
  bgImagePrompt: string
  bgImageAssetKey: string
  imageUrl: string
}

export type ScriptLine = DialogueLine | BgmLine | BgImageLine

export interface ScriptData {
  rawScript: string
  scriptLines: ScriptLine[]
  rawAnalysisResult: string
  characters: Character[]
}

export interface ScriptWorkspaceItem {
  id: string
  name: string
  data: ScriptData
}

export interface FocusableInput {
  focus: () => void
}

export type AudioPreviewTarget =
  | string
  | Partial<AudioAsset & Timbre & DialogueLine & { refPath: string }>

export interface WorkbenchContext {
  activeTab: Ref<WorkbenchTab>
  exportScriptState: () => Promise<void>
  isExportingProject: Ref<boolean>
  exportStatus: Ref<string>
  triggerImport: () => void
  triggerImportTxt: () => void
  exportSRT: () => Promise<void>
  isExportingAudio: Ref<boolean>
  exportAudio: () => Promise<void>
  videoResolution: Ref<string>
  generateVideo: () => Promise<void>
  isSequencePlaying: Ref<boolean>
  isGeneratingVideo: Ref<boolean>
  importFileRef: Ref<HTMLInputElement | null>
  handleImportFile: (event: Event) => Promise<void>
  importTxtRef: Ref<HTMLInputElement | null>
  handleImportTxt: (event: Event) => void
  bgImagePickerRef: Ref<HTMLInputElement | null>
  handleBgImageFileChange: (event: Event) => Promise<void>

  form: Ref<LlmConfig>
  isEditing: Ref<boolean>
  saveConfig: () => void
  resetForm: () => void
  llmConfigs: Ref<LlmConfig[]>
  editConfig: (config: LlmConfig) => void
  deleteConfig: (id: string) => void
  isEditingTts: Ref<boolean>
  ttsForm: Ref<TtsConfig>
  saveTtsConfig: () => void
  resetTtsForm: () => void
  ttsConfigs: Ref<TtsConfig[]>
  editTtsConfig: (config: TtsConfig) => void
  deleteTtsConfig: (id: string) => void

  isEditingTimbre: Ref<boolean>
  timbreForm: Ref<Timbre>
  handleTimbreFileUpload: (event: Event) => void
  saveTimbre: () => Promise<void>
  resetTimbreForm: () => void
  timbres: Ref<Timbre[]>
  playPreview: (item: AudioPreviewTarget) => Promise<void>
  previewPlayingFile: Ref<string | null>
  editTimbre: (timbre: Timbre) => void
  deleteTimbre: (id: string) => Promise<void>
  isEditingEmotion: Ref<boolean>
  emotionForm: Ref<EmotionPreset>
  saveEmotion: () => void
  resetEmotionForm: () => void
  emotionPresets: Ref<EmotionPreset[]>
  isSystemEmotion: (name: string) => boolean
  editEmotion: (emotion: EmotionPreset) => void
  deleteEmotion: (id: string) => void

  isEditingSfx: Ref<boolean>
  sfxForm: Ref<AudioAsset>
  handleSfxFileUpload: (event: Event) => void
  drawWaveform: (canvas: HTMLCanvasElement | null, item: AudioPreviewTarget) => Promise<void>
  startDragTrim: (event: MouseEvent, item: AudioPreviewTarget, type: 'start' | 'end') => void
  playbackProgress: Ref<number>
  saveSfx: () => Promise<void>
  resetSfxForm: () => void
  sfxLibrary: Ref<AudioAsset[]>
  editSfx: (sfx: AudioAsset) => void
  deleteSfx: (id: string) => void
  isEditingBgm: Ref<boolean>
  bgmForm: Ref<AudioAsset>
  handleBgmFileUpload: (event: Event) => void
  saveBgm: () => Promise<void>
  resetBgmForm: () => void
  bgmLibrary: Ref<AudioAsset[]>
  editBgm: (bgm: AudioAsset) => void
  deleteBgm: (id: string) => void
  isEditingFilter: Ref<boolean>
  filterForm: Ref<FilterConfig>
  saveFilter: () => void
  resetFilterForm: () => void
  filterLibrary: Ref<FilterConfig[]>
  editFilter: (filter: FilterConfig) => void
  deleteFilter: (id: string) => void

  scriptList: Ref<ScriptWorkspaceItem[]>
  currentScriptId: Ref<string>
  editingScriptId: Ref<string | null>
  switchScript: (id: string) => void
  startEditingScript: (id: string) => void
  stopEditingScript: () => void
  scriptNameInputRefs: Ref<Record<string, FocusableInput>>
  deleteScriptTab: (id: string) => void
  addScript: () => void
  characters: Ref<Character[]>
  addCharacter: () => void
  deleteCharacter: (id: string) => void
  analyzeCharacterVoice: (character: Character) => Promise<void>
  generateQwenVoice: (character: Character) => Promise<void>
  rawScript: Ref<string>
  currentConfigId: Ref<string>
  currentTtsConfigId: Ref<string>
  analyzeScript: () => Promise<void>
  isAnalyzingScript: Ref<boolean>
  addDialogueBlock: () => void
  addBgmBlock: () => void
  addBgImageBlock: () => void
  bgImageCount: Ref<number>
  generateAllLines: () => Promise<void>
  isGeneratingAll: Ref<boolean>
  selectedLineIndex: Ref<number>
  clearAllGeneratedAudio: () => Promise<void>
  playScriptSequentially: () => Promise<void>
  stopScriptSequentially: () => void
  scriptLines: Ref<ScriptLine[]>
  stageBgUrl: Ref<string>
  scriptListContainer: Ref<HTMLElement | null>
  lineRefs: Ref<HTMLElement[]>
  toggleLineSelection: (index: number, event?: MouseEvent) => void
  currentSequenceIndex: Ref<number>
  moveLineUp: (index: number) => void
  moveLineDown: (index: number) => void
  removeScriptLine: (index: number) => void
  openImagePreview: (url: string) => void
  openBgImagePicker: (lineIndex: number) => void
  copyBgImagePrompt: (line: BgImageLine) => Promise<void>
  availableRoles: ComputedRef<string[]>
  generateLineAudio: (line: DialogueLine, externalSignal?: AbortSignal | null) => Promise<void>
  isAuditioningId: Ref<string | null>
  playLineAudio: (line: DialogueLine, stopPreviousSfx?: boolean) => Promise<void>
  clearLineAudio: (line: DialogueLine) => Promise<void>
  autoResizeTextarea: (event: Event) => void
  addLineSfx: (line: DialogueLine) => void
  removeLineSfx: (line: DialogueLine, index: number) => void
  rawAnalysisResult: Ref<string>

  savePrompt: () => void
  resetPrompt: () => void
  useCustomPrompt: Ref<boolean>
  customPromptTemplate: Ref<string>
  saveVoicePrompt: () => void
  resetVoicePrompt: () => void
  useCustomVoicePrompt: Ref<boolean>
  customVoicePromptTemplate: Ref<string>
  saveQwenVoiceText: () => void
  resetQwenVoiceText: () => void
  useCustomQwenVoiceText: Ref<boolean>
  customQwenVoiceTextTemplate: Ref<string>
}
