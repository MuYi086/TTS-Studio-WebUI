/**
 * @fileoverview 图片预览状态组合函数
 * @description 管理背景图片大图预览的打开与关闭
 * - 状态：当前预览图片 URL
 * - 动作：打开预览、关闭预览
 * @module src/composables/useImagePreview
 */
import { ref } from 'vue'

/**
 * 管理图片大图预览状态。
 * @returns {object} 图片预览状态与动作。
 */
export function useImagePreview() {
  /** 当前预览图片 URL。 */
  const previewImageUrl = ref('')

  /**
   * 打开图片预览。
   * @param {string} url - 图片 URL。
   * @returns {void}
   */
  const openImagePreview = (url: string): void => {
    if (!url) return
    previewImageUrl.value = url
  }

  /**
   * 关闭图片预览。
   * @returns {void}
   */
  const closeImagePreview = (): void => {
    previewImageUrl.value = ''
  }

  return {
    previewImageUrl,
    openImagePreview,
    closeImagePreview
  }
}
