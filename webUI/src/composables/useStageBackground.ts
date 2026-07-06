/**
 * @fileoverview 脚本舞台背景状态组合函数
 * @description 管理顺序播放和视频导出期间的背景图片状态
 * - 当前背景：舞台使用的背景 URL
 * - 淡入状态：记录上一张背景和切换时间
 * - 动作：设置背景、清空背景
 * @module src/composables/useStageBackground
 */
import { ref } from 'vue'

/** 舞台背景配置。 */
export interface StageBackgroundOptions {
  /** 背景淡入时长。 */
  fadeDurationMs?: number
}

/**
 * 管理脚本舞台背景状态。
 * @param {StageBackgroundOptions} [options] - 舞台背景配置。
 * @returns {object} 舞台背景状态与动作。
 */
export function useStageBackground(options: StageBackgroundOptions = {}) {
  /** 当前背景图片 URL。 */
  const stageBgUrl = ref('')
  /** 上一张背景图片 URL。 */
  const stageBgFadePrevUrl = ref('')
  /** 当前淡入开始时间戳。 */
  const stageBgFadeStartTs = ref(0)
  /** 背景淡入时长。 */
  const stageBgFadeDurationMs = options.fadeDurationMs ?? 250

  /**
   * 设置舞台背景，并记录淡入状态。
   * @param {string} url - 背景图片 URL。
   * @returns {void}
   */
  const setStageBgUrlWithFade = (url: string): void => {
    const next = url || ''
    const prev = stageBgUrl.value || ''
    if (prev === next) return

    stageBgFadePrevUrl.value = prev
    stageBgFadeStartTs.value = performance.now()
    stageBgUrl.value = next
  }

  /**
   * 清空舞台背景与淡入状态。
   * @returns {void}
   */
  const clearStageBgWithFade = (): void => {
    stageBgFadePrevUrl.value = ''
    stageBgFadeStartTs.value = 0
    stageBgUrl.value = ''
  }

  return {
    stageBgUrl,
    stageBgFadePrevUrl,
    stageBgFadeStartTs,
    stageBgFadeDurationMs,
    setStageBgUrlWithFade,
    clearStageBgWithFade
  }
}
