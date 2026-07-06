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
import {
  ElAvatar,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCol,
  ElDivider,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLink,
  ElOption,
  ElRow,
  ElSelect,
  ElSlider,
  ElSpace,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTag
} from 'element-plus'
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleClose,
  Close,
  Delete,
  DocumentAdd,
  Download,
  FolderOpened,
  Headset,
  Lightning,
  Picture,
  Plus,
  RefreshLeft,
  Tickets,
  Upload,
  VideoCamera,
  VideoPlay
} from '@element-plus/icons-vue'
import 'element-plus/es/components/avatar/style/css'
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/card/style/css'
import 'element-plus/es/components/checkbox/style/css'
import 'element-plus/es/components/col/style/css'
import 'element-plus/es/components/divider/style/css'
import 'element-plus/es/components/empty/style/css'
import 'element-plus/es/components/form/style/css'
import 'element-plus/es/components/icon/style/css'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/link/style/css'
import 'element-plus/es/components/option/style/css'
import 'element-plus/es/components/row/style/css'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/slider/style/css'
import 'element-plus/es/components/space/style/css'
import 'element-plus/es/components/switch/style/css'
import 'element-plus/es/components/tabs/style/css'
import 'element-plus/es/components/tag/style/css'
import App from './App.vue'
import './assets/main.css'

/** WebUI 根应用实例。 */
const app = createApp(App)

const elementComponents = [
  ElAvatar,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCol,
  ElDivider,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLink,
  ElOption,
  ElRow,
  ElSelect,
  ElSlider,
  ElSpace,
  ElSwitch,
  ElTabPane,
  ElTabs,
  ElTag
]

for (const component of elementComponents) {
  app.component(component.name, component)
}

const elementIcons = [
  ArrowDown,
  ArrowUp,
  Check,
  CircleClose,
  Close,
  Delete,
  DocumentAdd,
  Download,
  FolderOpened,
  Headset,
  Lightning,
  Picture,
  Plus,
  RefreshLeft,
  Tickets,
  Upload,
  VideoCamera,
  VideoPlay
]

for (const icon of elementIcons) {
  app.component(icon.name, icon)
}

app.use(createPinia())
app.mount('#unitale-root')
