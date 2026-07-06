/**
 * @fileoverview Blob 编码工具
 * @description 提供工程导入导出所需的 Blob 与 Base64 互转
 * - 导出：将 Blob/File 转成 data URL
 * - 导入：将 data URL 还原为 Blob
 * @module src/utils/blob
 */

/**
 * 将 Blob 转换为 Base64 data URL。
 * @param {Blob} blob - 原始二进制对象。
 * @returns {Promise<string>} Base64 data URL。
 */
export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

/**
 * 将 Base64 data URL 还原为 Blob。
 * @param {string} base64 - Base64 data URL。
 * @param {string} mimeType - Blob MIME 类型。
 * @returns {Blob} 还原后的 Blob。
 */
export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteString = atob(base64.split(',')[1])
  const buffer = new ArrayBuffer(byteString.length)
  const view = new Uint8Array(buffer)

  for (let index = 0; index < byteString.length; index += 1) {
    view[index] = byteString.charCodeAt(index)
  }

  return new Blob([buffer], { type: mimeType })
}
