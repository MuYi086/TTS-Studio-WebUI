import type { BgmLine, BgImageLine, DialogueLine, ScriptLine } from '../types/workbench'

const createLineId = (): string =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

export const splitRawScriptToTexts = (rawScript: string): string[] => {
  const normalizedText = rawScript.replace(/\r\n/g, '\n')
  const splitRegex = /\n+|(?<=[。！？!?])(?=["']?)\s*/

  return normalizedText
    .split(splitRegex)
    .map(line => line.trim())
    .filter(Boolean)
}

export const createDialogueLine = (text = ''): DialogueLine => ({
  id: createLineId(),
  type: 'dialogue',
  role: '旁白',
  emotion: '平静',
  intensity: '中等',
  filter: '',
  text,
  trimStart: 0,
  trimEnd: 1,
  sfx: [],
  break_duration: 0,
  sfxVolume: 1.0,
  dialogueVolume: 1.0,
  speed: 1.0,
  audioUrl: '',
  isGenerating: false
})

export const createBgmLine = (bgmName = ''): BgmLine => ({
  id: createLineId(),
  type: 'bgm',
  action: 'play',
  volume: 1.0,
  bgmName
})

export const createBgImageLine = (): BgImageLine => ({
  id: createLineId(),
  type: 'bgImage',
  bgImagePrompt: '',
  bgImageAssetKey: '',
  imageUrl: ''
})

export const splitRawScriptToDialogueLines = (rawScript: string): DialogueLine[] =>
  splitRawScriptToTexts(rawScript).map(text => createDialogueLine(text))

export const insertScriptLineAfterSelection = (
  scriptLines: ScriptLine[],
  selectedLineIndex: number,
  newLine: ScriptLine
): number => {
  if (selectedLineIndex !== -1 && selectedLineIndex < scriptLines.length) {
    const insertIndex = selectedLineIndex + 1
    scriptLines.splice(insertIndex, 0, newLine)
    return insertIndex
  }

  scriptLines.push(newLine)
  return scriptLines.length - 1
}

export const removeScriptLineAt = (
  scriptLines: ScriptLine[],
  index: number,
  selectedLineIndex: number
): number => {
  if (index < 0 || index >= scriptLines.length) return selectedLineIndex

  scriptLines.splice(index, 1)

  if (selectedLineIndex === index) return -1
  if (selectedLineIndex > index) return selectedLineIndex - 1
  return selectedLineIndex
}
