/**
 * @fileoverview 应用配置 Store 模块
 * @description 管理 WebUI 的基础展示配置
 * - 应用标识：名称与版本号
 * - 视图状态：默认激活标签页
 * - 后续扩展：可作为全局 UI 配置入口
 * @module src/stores/appConfig
 */
import { defineStore } from 'pinia'
import type { WorkbenchTab } from '../types/workbench'

/**
 * 应用级配置 Store。
 * @example
 * const store = useAppConfigStore()
 * store.setDefaultTab('script')
 */
export const useAppConfigStore = defineStore('appConfig', {
  state: () => ({
    appName: 'TTS',
    version: '1.5',
    defaultTab: 'script' as WorkbenchTab
  }),
  actions: {
    /**
     * 更新默认激活的工作台标签页。
     * @param {WorkbenchTab} tab - 工作台标签页标识。
     * @returns {void}
     */
    setDefaultTab(tab: WorkbenchTab) {
      this.defaultTab = tab
    }
  }
})
