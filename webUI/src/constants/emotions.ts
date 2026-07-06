/**
 * @fileoverview 情绪预设常量
 * @description 提供系统内置情绪和强度映射
 * - 系统情绪：IndexTTS 使用的 8 维情感向量
 * - 强度映射：将中文强度描述转换为数值权重
 * - 判断工具：识别情绪是否为系统预设
 * @module src/constants/emotions
 */

/** 系统预设情绪列表。 */
export const SYSTEM_EMOTIONS = [
  { id: 'sys_1', name: '高兴', vector: [1, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'sys_2', name: '生气', vector: [0, 1, 0, 0, 0, 0, 0, 0] },
  { id: 'sys_3', name: '伤心', vector: [0, 0, 1, 0, 0, 0, 0, 0] },
  { id: 'sys_4', name: '害怕', vector: [0, 0, 0, 1, 0, 0, 0, 0] },
  { id: 'sys_5', name: '厌恶', vector: [0, 0, 0, 0, 1, 0, 0, 0] },
  { id: 'sys_6', name: '低落', vector: [0, 0, 0, 0, 0, 1, 0, 0] },
  { id: 'sys_7', name: '惊喜', vector: [0, 0, 0, 0, 0, 0, 1, 0] },
  { id: 'sys_8', name: '平静', vector: [0, 0, 0, 0, 0, 0, 0, 1] }
]

/** 情绪强度文本到数值权重的映射。 */
export const INTENSITY_VALUE_MAP: Record<string, number> = {
  '微弱': 0.2,
  '稍弱': 0.35,
  '中等': 0.5,
  '较强': 0.75,
  '强烈': 1.0
}

/**
 * 判断情绪名称是否属于系统预设情绪。
 * @param {string} name - 情绪名称。
 * @returns {boolean} 是否为系统预设。
 */
export const isSystemEmotion = (name: string): boolean =>
  SYSTEM_EMOTIONS.some((emotion) => emotion.name === name)
