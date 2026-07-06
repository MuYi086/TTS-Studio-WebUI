/**
 * @fileoverview TTS 请求工具
 * @description 封装语音合成服务地址处理
 * - 地址清理：移除多余尾部斜杠
 * - 兼容处理：去除 OpenAI 风格 `/v1` 后缀
 * @module src/utils/tts
 */

/**
 * 规范化 TTS 服务根地址。
 * @param {string} baseUrl - 用户配置的 TTS 地址。
 * @returns {string} 去除尾部 `/v1` 的服务根地址。
 */
export const toTtsBaseUrl = (baseUrl: string): string => {
  let url = baseUrl.trim().replace(/\/+$/, '')
  if (url.endsWith('/v1')) url = url.slice(0, -3)
  return url
}
