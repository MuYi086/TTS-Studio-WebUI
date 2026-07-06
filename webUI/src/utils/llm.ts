/**
 * @fileoverview LLM 请求工具
 * @description 封装 OpenAI 兼容接口的地址规范化和请求体构建
 * - 地址规范化：补齐 chat completions 路径
 * - 参数合并：解析用户配置的 JSON 附加参数
 * - 流式开关：统一处理 stream 字段
 * @module src/utils/llm
 */

/** OpenAI 兼容消息结构。 */
export interface ChatMessage {
  /** 消息角色。 */
  role: string
  /** 消息内容。 */
  content: string
}

/** LLM 配置结构。 */
export interface LlmRequestConfig {
  /** 模型名称。 */
  model: string
  /** 额外 JSON 参数。 */
  params?: string
}

/**
 * 规范化 LLM chat completions 接口地址。
 * @param {string} baseUrl - 用户配置的基础地址。
 * @returns {string} 补全后的 chat completions 地址。
 */
export const toChatCompletionsUrl = (baseUrl: string): string => {
  let url = baseUrl.trim().replace(/\/+$/, '')
  if (!url.endsWith('/chat/completions')) url += '/chat/completions'
  return url
}

/**
 * 组装 OpenAI 兼容接口请求体。
 * @param {LlmRequestConfig} cfg - 当前模型配置。
 * @param {ChatMessage[]} messages - 对话消息列表。
 * @param {boolean} [stream=false] - 是否启用流式输出。
 * @returns {Record<string, unknown>} 最终请求体。
 */
export const buildLlmBody = (
  cfg: LlmRequestConfig,
  messages: ChatMessage[],
  stream = false
): Record<string, unknown> => {
  let body: Record<string, unknown> = { model: cfg.model, messages, stream }

  if (cfg.params) {
    try {
      body = { ...body, ...JSON.parse(cfg.params) }
    } catch (error) {
      console.warn('解析额外参数失败:', error)
    }
  }

  return body
}
