/**
 * @fileoverview 工作台激活标签页状态
 * @description 恢复并持久化用户最后访问的工作台标签页
 * @module src/composables/useActiveWorkbenchTab
 */
import { ref, watch } from 'vue'
import { STORAGE_KEYS } from '../constants/storageKeys'
import type { WorkbenchTab } from '../types/workbench'
import { readLocalText, writeLocalText } from '../utils/storage'

export const WORKBENCH_TABS: WorkbenchTab[] = ['config', 'timbres', 'sfx', 'script', 'prompt']

export const isWorkbenchTab = (value: string): value is WorkbenchTab =>
  WORKBENCH_TABS.includes(value as WorkbenchTab)

/**
 * 创建工作台激活标签页状态。
 * @param defaultTab - 默认标签页，非法值会回退到脚本页。
 * @returns 当前激活标签页。
 */
export function useActiveWorkbenchTab(defaultTab: string) {
  const fallbackTab = isWorkbenchTab(defaultTab) ? defaultTab : 'script'
  const savedTab = readLocalText(STORAGE_KEYS.activeTab)
  const activeTab = ref<WorkbenchTab>(isWorkbenchTab(savedTab) ? savedTab : fallbackTab)

  watch(activeTab, newValue => {
    writeLocalText(STORAGE_KEYS.activeTab, newValue)
  })

  return {
    activeTab
  }
}
