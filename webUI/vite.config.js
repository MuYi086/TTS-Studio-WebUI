/**
 * @fileoverview Vite 构建配置
 * @description 定义 WebUI 的开发与预览环境
 * - Vue SFC：启用 Vue 官方插件
 * - Tailwind：启用 Tailwind Vite 插件
 * - 本地端口：约定 dev 与 preview 的访问端口
 * @module vite.config
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/** WebUI 的 Vite 配置。 */
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
})
