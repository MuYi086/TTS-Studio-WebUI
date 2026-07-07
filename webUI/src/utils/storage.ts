/**
 * @fileoverview localStorage 读写工具
 * @description 为配置、Prompt 和工作台 UI 状态提供容错的本地持久化读写
 * @module src/utils/storage
 */

export const readLocalText = (key: string, fallback = ''): string => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch (error) {
    console.warn(`读取本地配置失败: ${key}`, error)
    return fallback
  }
}

export const writeLocalText = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch (error) {
    console.warn(`写入本地配置失败: ${key}`, error)
  }
}

export const removeLocalValue = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn(`删除本地配置失败: ${key}`, error)
  }
}

export const readLocalJson = <T>(key: string, fallback: T): T => {
  const raw = readLocalText(key, '')
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const writeLocalJson = (key: string, value: unknown): void => {
  writeLocalText(key, JSON.stringify(value))
}

export const readLocalBoolean = (key: string, fallback = false): boolean => {
  const raw = readLocalText(key, '')
  if (!raw) return fallback

  try {
    return Boolean(JSON.parse(raw))
  } catch {
    return fallback
  }
}

export const writeLocalBoolean = (key: string, value: boolean): void => {
  writeLocalJson(key, value)
}

export const readLocalNumber = (key: string, fallback = 0): number => {
  const raw = readLocalText(key, '')
  if (!raw) return fallback

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}
