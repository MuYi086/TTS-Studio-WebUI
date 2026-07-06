/**
 * @fileoverview Vite 环境类型声明
 * @description 补充构建环境与浏览器全局变量类型
 * - Vite：引入客户端类型声明
 * - Window：声明统计脚本使用的 dataLayer
 * @module src/vite-env
 */
/// <reference types="vite/client" />

/** 浏览器全局对象扩展。 */
interface Window {
  /** Google Analytics 使用的数据层。 */
  dataLayer?: unknown[]
}
