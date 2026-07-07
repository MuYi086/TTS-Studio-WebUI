/**
 * @fileoverview 工作台上下文注入工具
 * @description 为拆分后的工作台组件提供共享状态访问入口
 * - 上下文键：统一的 provide/inject Symbol
 * - 读取封装：在缺失 provider 时抛出清晰错误
 * - 迁移用途：降低顶层 tab 组件的 prop drilling 成本
 * @module src/composables/useWorkbenchContext
 */
import { inject } from 'vue'
import type { InjectionKey } from 'vue'
import type { WorkbenchContext } from '../types/workbench'

/** 工作台上下文注入键。 */
export const workbenchContextKey: InjectionKey<WorkbenchContext> = Symbol('workbench-context')

/**
 * 读取工作台上下文。
 * @returns 当前工作台暴露的状态与动作集合。
 * @throws {Error} 未在上层提供上下文时抛出错误。
 */
export function useWorkbenchContext(): WorkbenchContext {
  const context = inject(workbenchContextKey)

  if (!context) {
    throw new Error('Workbench context was not provided.')
  }

  return context
}
