/**
 * @fileoverview Axios 请求工具模块
 * @description 为 WebUI 提供统一的 HTTP 请求封装
 * - 实例配置：集中维护超时与拦截扩展入口
 * - 错误处理：将 Axios 错误转换为浏览器侧可消费的 Error
 * - 请求辅助：统一 JSON、Blob、FormData 请求写法
 * @module src/utils/http
 */
import axios, { type AxiosRequestConfig } from 'axios'

/** WebUI 默认 Axios 实例。 */
export const http = axios.create({
  timeout: 0
})

/**
 * 标准化 Axios 错误对象。
 * @param {any} error - Axios 抛出的原始错误。
 * @returns {Error} 统一后的错误对象。
 */
function formatAxiosError(error: any): Error {
  if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
    error.name = 'AbortError'
    return error
  }

  const status = error.response?.status
  const payload = error.response?.data
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload || {})
  return new Error(status ? `HTTP ${status}: ${message}` : error.message)
}

/**
 * 发送 GET 请求并返回 JSON 数据。
 * @template T
 * @param {string} url - 请求地址。
 * @param {AxiosRequestConfig} [config={}] - Axios 请求配置。
 * @returns {Promise<T>} 解析后的响应数据。
 */
export async function getJson<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const response = await http.get(url, config)
    return response.data
  } catch (error) {
    throw formatAxiosError(error)
  }
}

/**
 * 发送 JSON POST 请求。
 * @template T
 * @param {string} url - 请求地址。
 * @param {unknown} data - 请求体数据。
 * @param {AxiosRequestConfig} [config={}] - Axios 请求配置。
 * @returns {Promise<T>} 解析后的响应数据。
 */
export async function postJson<T = any>(url: string, data: unknown, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const response = await http.post(url, data, {
      ...config,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    })
    return response.data
  } catch (error) {
    throw formatAxiosError(error)
  }
}

/**
 * 发送 POST 请求并返回二进制 Blob。
 * @param {string} url - 请求地址。
 * @param {unknown} data - 请求体数据。
 * @param {AxiosRequestConfig} [config={}] - Axios 请求配置。
 * @returns {Promise<Blob>} 响应二进制数据。
 */
export async function postBlob(url: string, data: unknown, config: AxiosRequestConfig = {}): Promise<Blob> {
  try {
    const response = await http.post(url, data, {
      ...config,
      responseType: 'blob'
    })
    return response.data
  } catch (error) {
    throw formatAxiosError(error)
  }
}

/**
 * 发送 FormData POST 请求。
 * @template T
 * @param {string} url - 请求地址。
 * @param {FormData} formData - 表单数据。
 * @param {AxiosRequestConfig} [config={}] - Axios 请求配置。
 * @returns {Promise<T>} 解析后的响应数据。
 */
export async function postForm<T = any>(url: string, formData: FormData, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const response = await http.post(url, formData, config)
    return response.data
  } catch (error) {
    throw formatAxiosError(error)
  }
}
