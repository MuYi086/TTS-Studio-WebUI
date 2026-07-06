/**
 * @fileoverview 音频处理工具
 * @description 提供音频导出与滤波处理所需的纯函数
 * - 失真曲线：生成 WebAudio WaveShaper 曲线
 * - WAV 编码：将 AudioBuffer 转换为 WAV Blob
 * @module src/utils/audio
 */

/**
 * 生成失真滤波器曲线。
 * @param {number} amount - 失真强度。
 * @returns {Float32Array} WaveShaper 可用曲线。
 */
export const makeDistortionCurve = (amount: number): Float32Array => {
  const k = typeof amount === 'number' ? amount : 50
  const sampleCount = 44100
  const curve = new Float32Array(sampleCount)
  const deg = Math.PI / 180

  for (let index = 0; index < sampleCount; index += 1) {
    const x = (index * 2) / sampleCount - 1
    curve[index] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
  }

  return curve
}

/**
 * 将 AudioBuffer 转换为可下载的 WAV Blob。
 * @param {AudioBuffer} audioBuffer - 渲染后的音频缓冲区。
 * @param {number} frameLength - 采样帧长度。
 * @returns {Blob} WAV 文件 Blob。
 */
export function audioBufferToWaveBlob(audioBuffer: AudioBuffer, frameLength: number): Blob {
  const channelCount = audioBuffer.numberOfChannels
  const length = frameLength * channelCount * 2 + 44
  const buffer = new ArrayBuffer(length)
  const view = new DataView(buffer)
  const channels = []
  let offset = 0
  let position = 0

  const setUint16 = (data: number): void => {
    view.setUint16(offset, data, true)
    offset += 2
  }

  const setUint32 = (data: number): void => {
    view.setUint32(offset, data, true)
    offset += 4
  }

  setUint32(0x46464952)
  setUint32(length - 8)
  setUint32(0x45564157)
  setUint32(0x20746d66)
  setUint32(16)
  setUint16(1)
  setUint16(channelCount)
  setUint32(audioBuffer.sampleRate)
  setUint32(audioBuffer.sampleRate * 2 * channelCount)
  setUint16(channelCount * 2)
  setUint16(16)
  setUint32(0x61746164)
  setUint32(length - offset - 4)

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel))
  }

  while (position < frameLength) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      let sample = Math.max(-1, Math.min(1, channels[channel][position]))
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0
      view.setInt16(offset, sample, true)
      offset += 2
    }
    position += 1
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
