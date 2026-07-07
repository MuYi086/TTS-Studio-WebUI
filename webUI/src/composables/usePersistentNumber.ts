/**
 * @fileoverview 持久化数字状态
 * @description 用于工作台中需要 localStorage 恢复的轻量数字状态
 * @module src/composables/usePersistentNumber
 */
import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import { readLocalNumber, writeLocalText } from '../utils/storage'

interface UsePersistentNumberOptions {
  min?: number
}

const normalizeNumber = (
  value: number,
  fallback: number,
  options: UsePersistentNumberOptions
): number => {
  const finiteValue = Number.isFinite(value) ? value : fallback
  return options.min === undefined ? finiteValue : Math.max(options.min, finiteValue)
}

/**
 * 创建会同步到 localStorage 的数字 ref。
 * @param key - localStorage 键名。
 * @param fallback - 读取失败或值非法时的回退值。
 * @param options - 数字约束。
 * @returns 可直接用于组件状态的数字 ref。
 */
export function usePersistentNumber(
  key: string,
  fallback = 0,
  options: UsePersistentNumberOptions = {}
): Ref<number> {
  const value = ref(normalizeNumber(readLocalNumber(key, fallback), fallback, options))

  watch(value, newValue => {
    const normalizedValue = normalizeNumber(Number(newValue), fallback, options)
    if (normalizedValue !== newValue) {
      value.value = normalizedValue
      return
    }
    writeLocalText(key, String(normalizedValue))
  })

  return value
}
