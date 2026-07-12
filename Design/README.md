# TTS Studio WebUI 视觉基准

本目录保存高保真还原所需的视觉参考，而不是运行时资源。

## 参考图与页面映射

| 文件 | 对应标签页 | 前端入口 |
| --- | --- | --- |
| `reference/01-model-config.webp` | 模型配置 | `webUI/src/components/ConfigPanel.vue` |
| `reference/02-timbre-library.webp` | 音色资源库 | `webUI/src/components/TimbresPanel.vue` |
| `reference/03-sfx-filters.webp` | 音效与滤波器 | `webUI/src/components/SfxPanel.vue` |
| `reference/04-script-production.webp` | 脚本制作 | `webUI/src/components/ScriptPanel.vue` |
| `reference/05-prompt-management.webp` | Prompt 管理 | `webUI/src/components/PromptPanel.vue` |

## 还原约束

- 桌面端主基准为 `1920 × 1080`；窄屏只做信息重排，不改变功能层级。
- 全局色彩和间距先由 `webUI/src/app/styles/main.css` 的 `--tts-*` 变量定义，再由组件消费。
- 业务行为、存储键、LLM/TTS 协议与导出链路不得因视觉重构改变。
- 视觉对比按“全局壳层 → Tab 导航 → 卡片/表单 → 面板局部”顺序进行；每轮保留截图和差异记录。
