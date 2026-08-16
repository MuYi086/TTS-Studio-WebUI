# TTS Studio WebUI 视觉基准

本目录保存界面参考图，不是运行时资源。当前产品是根目录 [`index.html`](../index.html) 中的单文件 Vue WebUI，`webUI/src` 已废弃，不要按旧组件路径实施视觉改动。

## 参考图与页面映射

| 文件 | 对应标签页 | 当前实现 |
| --- | --- | --- |
| `reference/01-model-config.webp` | 模型配置 | `index.html` 的 `config` 标签页 |
| `reference/02-timbre-library.webp` | 音色资源库 | `index.html` 的 `timbres` 标签页 |
| `reference/03-sfx-filters.webp` | 背景音乐（历史图含已废弃滤镜） | `index.html` 的 `sfx` 标签页 |
| `reference/04-script-production.webp` | 脚本制作 | `index.html` 的 `script` 标签页 |
| `reference/05-prompt-management.webp` | Prompt 管理 | `index.html` 的 `prompt` 标签页 |

## 还原约束

- 桌面端主基准为 `1920 × 1080`；窄屏只做信息重排，不改变功能层级。
- 当前页面使用 Tailwind CDN 与 `index.html` 内联样式；没有独立的 CSS 变量文件或 Vue 组件目录。
- 业务行为、存储键、LLM/TTS 协议与导出链路不得因视觉调整改变。
- 视觉对比按“全局壳层 → Tab 导航 → 卡片/表单 → 面板局部”顺序进行；每轮保留截图和差异记录。
