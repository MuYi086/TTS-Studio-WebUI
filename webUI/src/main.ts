/**
 * @fileoverview WebUI 应用入口
 * @description 负责创建 Vue 应用并注册全局依赖
 * - 应用实例：挂载根组件 App
 * - 状态管理：注册 Pinia
 * - 全局样式：加载 Tailwind 与应用级样式
 * @module src/main
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'

/** WebUI 根应用实例。 */
const app = createApp(App)

app.use(createPinia())
app.mount('#unitale-root')
