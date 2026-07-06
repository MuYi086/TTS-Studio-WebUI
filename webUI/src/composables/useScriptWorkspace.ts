/**
 * @fileoverview 脚本页签工作区组合函数
 * @description 管理多脚本页签的切换、创建、重命名和删除
 * - 页签状态：脚本列表、当前脚本、编辑中的脚本名
 * - 上下文同步：切换前保存当前编辑区状态
 * - 操作约束：生成、分析、播放中禁止切换结构性状态
 * @module src/composables/useScriptWorkspace
 */
import { ref, type Ref } from 'vue'

/** 脚本工作区输入依赖。 */
export interface UseScriptWorkspaceOptions {
  /** 原文内容。 */
  rawScript: Ref<string>
  /** 脚本行列表。 */
  scriptLines: Ref<any[]>
  /** AI 原始分析结果。 */
  rawAnalysisResult: Ref<string>
  /** 当前脚本角色列表。 */
  characters: Ref<any[]>
  /** 是否正在分析脚本。 */
  isAnalyzingScript: Ref<boolean>
  /** 是否正在批量生成。 */
  isGeneratingAll: Ref<boolean>
  /** 是否正在顺序播放。 */
  isSequencePlaying: Ref<boolean>
  /** 当前选中行索引。 */
  selectedLineIndex: Ref<number>
  /** 触发工程自动保存。 */
  triggerAutoSave: () => void
}

/**
 * 创建脚本工作区状态。
 * @param {UseScriptWorkspaceOptions} options - 工作区输入依赖。
 * @returns {object} 脚本页签状态与动作。
 */
export function useScriptWorkspace(options: UseScriptWorkspaceOptions) {
  const {
    rawScript,
    scriptLines,
    rawAnalysisResult,
    characters,
    isAnalyzingScript,
    isGeneratingAll,
    isSequencePlaying,
    selectedLineIndex,
    triggerAutoSave
  } = options

  /** 脚本页签列表。 */
  const scriptList = ref([
    { id: 'default', name: '脚本 1', data: { rawScript: '', scriptLines: [], rawAnalysisResult: '', characters: [] } }
  ])
  /** 当前激活脚本 ID。 */
  const currentScriptId = ref('default')
  /** 正在编辑名称的脚本 ID。 */
  const editingScriptId = ref<string | null>(null)
  /** 脚本名称输入框引用集合。 */
  const scriptNameInputRefs = ref<Record<string, HTMLInputElement>>({})

  /**
   * 判断当前是否允许修改脚本页签结构。
   * @returns {boolean} 是否允许修改。
   */
  const canChangeWorkspace = (): boolean =>
    !isAnalyzingScript.value && !isGeneratingAll.value && !isSequencePlaying.value

  /**
   * 将当前编辑区状态回写到脚本页签列表。
   * @returns {void}
   */
  const syncCurrentScriptState = (): void => {
    const current = scriptList.value.find((script) => script.id === currentScriptId.value)
    if (!current) return

    current.data.rawScript = rawScript.value
    current.data.scriptLines = scriptLines.value
    current.data.rawAnalysisResult = rawAnalysisResult.value
    current.data.characters = characters.value.map((character) => {
      const { isAnalyzing, isGeneratingVoice, abortController, ...rest } = character
      return JSON.parse(JSON.stringify(rest))
    })
  }

  /**
   * 切换当前激活脚本页签，并恢复对应的编辑上下文。
   * @param {string} id - 目标脚本 ID。
   * @returns {void}
   */
  const switchScript = (id: string): void => {
    if (!canChangeWorkspace()) {
      alert('请先停止当前的生成或播放任务，再切换脚本。')
      return
    }
    if (id === currentScriptId.value) return

    syncCurrentScriptState()

    const target = scriptList.value.find((script) => script.id === id)
    if (!target) return

    currentScriptId.value = id
    rawScript.value = target.data.rawScript || ''
    scriptLines.value = target.data.scriptLines || []
    rawAnalysisResult.value = target.data.rawAnalysisResult || ''
    characters.value = target.data.characters || []
    characters.value.forEach((character) => {
      if (character.volume === undefined) character.volume = 1.0
    })
    selectedLineIndex.value = -1
  }

  /**
   * 创建一个新的脚本页签并切换过去。
   * @returns {void}
   */
  const addScript = (): void => {
    if (!canChangeWorkspace()) {
      alert('请先停止当前的生成或播放任务，再添加脚本。')
      return
    }

    syncCurrentScriptState()

    const newId = Date.now().toString()
    const nextIndex = scriptList.value.length + 1
    scriptList.value.push({
      id: newId,
      name: `脚本 ${nextIndex}`,
      data: { rawScript: '', scriptLines: [], rawAnalysisResult: '', characters: [] }
    })
    switchScript(newId)
  }

  /**
   * 开始编辑脚本名称。
   * @param {string} id - 脚本 ID。
   * @returns {void}
   */
  const startEditingScript = (id: string): void => {
    editingScriptId.value = id
    setTimeout(() => {
      scriptNameInputRefs.value[id]?.focus()
    }, 0)
  }

  /**
   * 停止编辑脚本名称。
   * @returns {void}
   */
  const stopEditingScript = (): void => {
    editingScriptId.value = null
  }

  /**
   * 删除脚本页签。
   * @param {string} id - 脚本 ID。
   * @returns {void}
   */
  const deleteScriptTab = (id: string): void => {
    if (!canChangeWorkspace()) {
      alert('请先停止当前的生成或播放任务，再删除脚本。')
      return
    }
    if (scriptList.value.length <= 1) {
      alert('至少保留一个脚本')
      return
    }
    if (!confirm('确定删除此脚本吗？')) return

    const index = scriptList.value.findIndex((script) => script.id === id)
    if (index === -1) return

    if (id === currentScriptId.value) {
      const nextIndex = index === 0 ? 1 : index - 1
      switchScript(scriptList.value[nextIndex].id)
    }
    scriptList.value.splice(index, 1)
    triggerAutoSave()
  }

  return {
    scriptList,
    currentScriptId,
    editingScriptId,
    scriptNameInputRefs,
    syncCurrentScriptState,
    switchScript,
    addScript,
    startEditingScript,
    stopEditingScript,
    deleteScriptTab
  }
}
