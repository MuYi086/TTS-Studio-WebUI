/**
 * @fileoverview 工作台资源库状态管理
 * @description 维护音色、音效、BGM、滤波器和情绪预设资源
 * @module src/composables/useResourceLibraries
 */
import { ref } from 'vue'
import type { Ref } from 'vue'
import { SYSTEM_EMOTIONS, isSystemEmotion } from '../constants/emotions'
import type { AudioAsset, Character, EmotionPreset, FilterConfig, Timbre, TtsConfig } from '../types/workbench'
import { getJson, postForm } from '../utils/http'
import { toTtsBaseUrl } from '../utils/tts'
import { saveAssetToDB } from '../utils/unitaleDb'

interface UseResourceLibrariesOptions {
  getLocalFileMap: () => Map<string, File>
  loadAudioBuffer: (filename: string) => Promise<AudioBuffer | null>
  triggerAutoSave: () => void
  currentTtsConfig: Readonly<Ref<TtsConfig | null>>
  currentTtsConfigId: Ref<string>
  ttsConfigs: Ref<TtsConfig[]>
}

/**
 * 创建素材资源库管理器。
 * @param options - 外部音频缓存、自动保存和 TTS 配置依赖。
 * @returns 资源库状态、表单状态和增删改动作。
 */
export function useResourceLibraries(options: UseResourceLibrariesOptions) {
  const {
    getLocalFileMap,
    loadAudioBuffer,
    triggerAutoSave,
    currentTtsConfig,
    currentTtsConfigId,
    ttsConfigs
  } = options

  const characters = ref<Character[]>([])

  const timbres = ref<Timbre[]>([])
  const timbreForm = ref<Timbre>({ id: '', name: '', description: '', refPath: '' })
  const isEditingTimbre = ref(false)
  const selectedTimbreId = ref('')
  const timbreFile = ref<File | null>(null)

  const emotionPresets = ref<EmotionPreset[]>([])
  const emotionForm = ref<EmotionPreset>({ id: '', name: '', vector: [0, 0, 0, 0, 0, 0, 0, 0] })
  const isEditingEmotion = ref(false)

  const sfxLibrary = ref<AudioAsset[]>([])
  const sfxForm = ref<AudioAsset>({ id: '', name: '', description: '', filename: '', trimStart: 0, trimEnd: 1, volume: 0.3 })
  const isEditingSfx = ref(false)

  const bgmLibrary = ref<AudioAsset[]>([])
  const bgmForm = ref<AudioAsset>({ id: '', name: '', description: '', filename: '', trimStart: 0, trimEnd: 1, volume: 0.3 })
  const isEditingBgm = ref(false)

  const filterLibrary = ref<FilterConfig[]>([])
  const filterForm = ref<FilterConfig>({ id: '', name: '', description: '', type: 'lowpass', frequency: 1000, Q: 1, gain: 0 })
  const isEditingFilter = ref(false)

  const initializeDefaultLibraries = (): void => {
    filterLibrary.value = [
      { id: 'f1', name: '电话音', description: '模拟电话通话时的窄频带声音', type: 'bandpass', frequency: 1700, Q: 1.5, gain: 0, enabled: true },
      { id: 'f2', name: '水下', description: '模拟在水下听到的闷声', type: 'lowpass', frequency: 400, Q: 1, gain: 0, enabled: true },
      { id: 'f3', name: '老广播', description: '模拟老式收音机或广播的尖锐声音', type: 'highpass', frequency: 1500, Q: 1, gain: 0, enabled: true },
      { id: 'f4', name: '机械失真', description: '模拟机器人或设备损坏时的失真声音', type: 'distortion', frequency: 1000, Q: 1, gain: 50, enabled: true }
    ]

    emotionPresets.value = [...SYSTEM_EMOTIONS]
  }

  const addCharacter = (): void => {
    characters.value.push({
      id: Date.now().toString(),
      name: '新角色',
      voiceFile: '',
      volume: 1.0
    })
  }

  const deleteCharacter = (id: string): void => {
    if (!confirm('确定删除此角色吗？')) return
    characters.value = characters.value.filter(character => character.id !== id)
  }

  const handleTimbreFileUpload = (event: Event): void => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      timbreForm.value.refPath = file.name
      timbreFile.value = file
      getLocalFileMap().set(file.name, file)
      saveAssetToDB(file.name, file)
      triggerAutoSave()
    }
    input.value = ''
  }

  const syncTimbresWithServer = async (): Promise<void> => {
    let config = currentTtsConfig.value
    if (!config && ttsConfigs.value.length > 0) {
      currentTtsConfigId.value = ttsConfigs.value[0].id
      config = ttsConfigs.value[0]
    }

    if (!config) {
      console.warn('未找到可用的 TTS 配置，无法同步音色文件。')
      return
    }

    const baseUrl = toTtsBaseUrl(config.baseUrl)
    console.log(`正在同步音色文件到服务器: ${baseUrl}`)

    for (const timbre of timbres.value) {
      if (!timbre.refPath) continue

      const file = getLocalFileMap().get(timbre.refPath)
      if (!file) {
        console.warn(`音色文件未在内存中找到 (可能未导入或丢失): ${timbre.refPath}`)
        continue
      }

      try {
        const checkUrl = `${baseUrl}/v1/check/audio?file_name=${encodeURIComponent(timbre.refPath)}`
        const checkData = await getJson(checkUrl)
        const exists = Boolean(checkData.exists)

        if (!exists) {
          console.log(`正在上传缺失的音色文件: ${timbre.name} (${timbre.refPath})`)
          const formData = new FormData()
          formData.append('audio', file)
          formData.append('full_path', timbre.refPath)

          await postForm(`${baseUrl}/v1/upload_audio`, formData)
        } else {
          console.log(`音色文件已存在: ${timbre.name}`)
        }
      } catch (error) {
        console.error(`同步音色 ${timbre.name} 失败:`, error)
      }
    }
    console.log('音色同步完成。')
  }

  const saveTimbre = async (): Promise<void> => {
    if (!timbreForm.value.name || !timbreForm.value.refPath) {
      alert('请填写音色名称并选择一个参考音频文件')
      return
    }

    if (!isEditingTimbre.value && !timbreFile.value) {
      alert('创建新音色时，必须选择一个参考音频文件。')
      return
    }

    let targetId = timbreForm.value.id
    if (!targetId) targetId = Date.now().toString()

    try {
      const newTimbreData = { ...timbreForm.value, id: targetId }

      if (isEditingTimbre.value) {
        const index = timbres.value.findIndex(timbre => timbre.id === targetId)
        if (index !== -1) timbres.value[index] = newTimbreData
      } else {
        timbres.value.push(newTimbreData)
      }
      resetTimbreForm()
    } catch (error) {
      console.error('保存音色时出错:', error)
      alert(`保存音色失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const editTimbre = (timbre: Timbre): void => {
    timbreForm.value = { ...timbre }
    isEditingTimbre.value = true
    timbreFile.value = null
  }

  const deleteTimbre = async (id: string): Promise<void> => {
    if (!confirm('确定删除此音色吗？')) return
    timbres.value = timbres.value.filter(timbre => timbre.id !== id)
    if (selectedTimbreId.value === id) selectedTimbreId.value = ''
  }

  const resetTimbreForm = (): void => {
    timbreForm.value = { id: '', name: '', description: '', refPath: '' }
    isEditingTimbre.value = false
    timbreFile.value = null
  }

  const saveSfx = async (): Promise<void> => {
    if (!sfxForm.value.name || !sfxForm.value.filename) {
      alert('请填写音效名称和文件路径')
      return
    }

    try {
      if (isEditingSfx.value) {
        const index = sfxLibrary.value.findIndex(sfx => sfx.id === sfxForm.value.id)
        if (index !== -1) sfxLibrary.value[index] = { ...sfxForm.value }
      } else {
        sfxLibrary.value.push({ ...sfxForm.value, id: Date.now().toString(), enabled: true })
      }
      if (sfxForm.value.filename) loadAudioBuffer(sfxForm.value.filename)
      resetSfxForm()
    } catch (error) {
      alert(`保存音效失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const editSfx = (sfx: AudioAsset): void => {
    sfxForm.value = { trimStart: 0, trimEnd: 1, volume: 1.0, ...sfx }
    isEditingSfx.value = true
  }

  const deleteSfx = (id: string): void => {
    if (!confirm('确定删除？')) return
    sfxLibrary.value = sfxLibrary.value.filter(sfx => sfx.id !== id)
  }

  const resetSfxForm = (): void => {
    sfxForm.value = { id: '', name: '', description: '', filename: '', trimStart: 0, trimEnd: 1, volume: 0.3 }
    isEditingSfx.value = false
  }

  const handleSfxFileUpload = (event: Event): void => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      sfxForm.value.filename = file.name
      sfxForm.value.trimStart = 0
      sfxForm.value.trimEnd = 1
      sfxForm.value.volume = 0.3
      getLocalFileMap().set(file.name, file)
      saveAssetToDB(file.name, file)
      triggerAutoSave()
      loadAudioBuffer(file.name)
    }
    input.value = ''
  }

  const saveBgm = async (): Promise<void> => {
    if (!bgmForm.value.name || !bgmForm.value.filename) {
      alert('请填写 BGM 名称和文件路径')
      return
    }

    try {
      if (isEditingBgm.value) {
        const index = bgmLibrary.value.findIndex(bgm => bgm.id === bgmForm.value.id)
        if (index !== -1) bgmLibrary.value[index] = { ...bgmForm.value }
      } else {
        bgmLibrary.value.push({ ...bgmForm.value, id: Date.now().toString(), enabled: true })
      }
      if (bgmForm.value.filename) loadAudioBuffer(bgmForm.value.filename)
      resetBgmForm()
    } catch (error) {
      alert(`保存 BGM 失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const editBgm = (bgm: AudioAsset): void => {
    bgmForm.value = { trimStart: 0, trimEnd: 1, volume: 1.0, ...bgm }
    isEditingBgm.value = true
  }

  const deleteBgm = (id: string): void => {
    if (!confirm('确定删除？')) return
    bgmLibrary.value = bgmLibrary.value.filter(bgm => bgm.id !== id)
  }

  const resetBgmForm = (): void => {
    bgmForm.value = { id: '', name: '', description: '', filename: '', trimStart: 0, trimEnd: 1, volume: 0.3 }
    isEditingBgm.value = false
  }

  const handleBgmFileUpload = (event: Event): void => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      bgmForm.value.filename = file.name
      bgmForm.value.trimStart = 0
      bgmForm.value.trimEnd = 1
      bgmForm.value.volume = 0.3
      getLocalFileMap().set(file.name, file)
      saveAssetToDB(file.name, file)
      triggerAutoSave()
      loadAudioBuffer(file.name)
    }
    input.value = ''
  }

  const saveFilter = (): void => {
    if (!filterForm.value.name) {
      alert('请填写滤波器名称')
      return
    }

    const newFilter = {
      ...filterForm.value,
      frequency: Number(filterForm.value.frequency),
      Q: Number(filterForm.value.Q),
      gain: Number(filterForm.value.gain)
    }

    if (isEditingFilter.value) {
      const index = filterLibrary.value.findIndex(filter => filter.id === filterForm.value.id)
      if (index !== -1) filterLibrary.value[index] = newFilter
    } else {
      filterLibrary.value.push({ ...newFilter, id: Date.now().toString(), enabled: true })
    }
    resetFilterForm()
  }

  const editFilter = (filter: FilterConfig): void => {
    filterForm.value = { ...filter }
    isEditingFilter.value = true
  }

  const deleteFilter = (id: string): void => {
    if (!confirm('确定删除此滤波器？')) return
    filterLibrary.value = filterLibrary.value.filter(filter => filter.id !== id)
  }

  const resetFilterForm = (): void => {
    filterForm.value = { id: '', name: '', description: '', type: 'lowpass', frequency: 1000, Q: 1, gain: 0 }
    isEditingFilter.value = false
  }

  const saveEmotion = (): void => {
    if (!emotionForm.value.name) {
      alert('请填写情绪名称')
      return
    }
    if (isSystemEmotion(emotionForm.value.name)) {
      alert('无法修改或覆盖系统预设情绪')
      return
    }

    if (isEditingEmotion.value) {
      const index = emotionPresets.value.findIndex(emotion => emotion.id === emotionForm.value.id)
      if (index !== -1) emotionPresets.value[index] = { ...emotionForm.value }
    } else {
      emotionPresets.value.push({ ...emotionForm.value, id: Date.now().toString(), enabled: true })
    }
    resetEmotionForm()
  }

  const editEmotion = (emotion: EmotionPreset): void => {
    emotionForm.value = { ...emotion }
    isEditingEmotion.value = true
  }

  const deleteEmotion = (id: string): void => {
    if (!confirm('确定删除？')) return
    emotionPresets.value = emotionPresets.value.filter(emotion => emotion.id !== id)
  }

  const resetEmotionForm = (): void => {
    emotionForm.value = { id: '', name: '', vector: [0, 0, 0, 0, 0, 0, 0, 0] }
    isEditingEmotion.value = false
  }

  const resetEmotionsToDefault = (): void => {
    if (!confirm('确定要重置所有情绪预设为默认值吗？这将清除自定义的情绪。')) return
    emotionPresets.value = [...SYSTEM_EMOTIONS]
  }

  initializeDefaultLibraries()

  return {
    characters,
    addCharacter,
    deleteCharacter,
    timbres,
    timbreForm,
    isEditingTimbre,
    handleTimbreFileUpload,
    syncTimbresWithServer,
    saveTimbre,
    editTimbre,
    deleteTimbre,
    resetTimbreForm,
    emotionPresets,
    emotionForm,
    isEditingEmotion,
    saveEmotion,
    editEmotion,
    deleteEmotion,
    resetEmotionForm,
    resetEmotionsToDefault,
    sfxLibrary,
    sfxForm,
    isEditingSfx,
    saveSfx,
    editSfx,
    deleteSfx,
    resetSfxForm,
    handleSfxFileUpload,
    bgmLibrary,
    bgmForm,
    isEditingBgm,
    saveBgm,
    editBgm,
    deleteBgm,
    resetBgmForm,
    handleBgmFileUpload,
    filterLibrary,
    filterForm,
    isEditingFilter,
    saveFilter,
    editFilter,
    deleteFilter,
    resetFilterForm,
    isSystemEmotion
  }
}
