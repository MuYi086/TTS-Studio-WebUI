# TTS Studio WebUI Agent 协作指南

## 阅读顺序与语言

修改代码、数据、文档或资产前，依次阅读 [CONSTITUTION.md](CONSTITUTION.md)、本文件和任务直接相关的源码、配置、测试与文档。面向用户和贡献者的文档、总结、评审意见和代理输出默认中文优先；必要英文术语首次出现时补中文说明。

## 仓库边界

- 当前开发入口是 [`webUI/`](webUI/)，应用入口为 `webUI/src/app/main.ts`；所有 npm 命令在 `webUI/` 执行。
- 根目录 `index.html`、`project-storage.js` 和 `voice-design.js` 是旧版对照物。除兼容性任务外，不要将新功能写回旧页。
- Vue 音色设计默认目录在 `webUI/src/services/providers/voiceDesignCatalog.ts`。
- 本地后端是独立仓库 [TTS-and-VoiceDesign](https://github.com/MuYi086/TTS-and-VoiceDesign)；前端接入边界见 [`docs/TTS-and-VoiceDesign接入.md`](docs/TTS-and-VoiceDesign接入.md)。

## 兼容性与职责

改动存储、工程导入导出、模型调用或音频时间轴前，必须先读 [`webUI/P0-兼容性红线.md`](webUI/P0-兼容性红线.md)。不得破坏 `UnitaleDB`、旧 `localStorage` 键、工程 schema、资产键和 `dialogue` / `bgm` / `bgImage` 的时间轴语义。

| 范围 | 首选位置 |
| --- | --- |
| schema、规范化与工厂函数 | `webUI/src/domain/` |
| 存储与工程传输 | `webUI/src/services/storage/` |
| LLM/TTS/音色设计 HTTP 调用 | `webUI/src/services/providers/` |
| 配置、资源库、工程与运行状态 | `webUI/src/stores/` |
| 播放、批量合成与导出流程 | `webUI/src/composables/` |
| 展示和用户意图 | `webUI/src/components/` |

保持 Props Down / Events Up（属性向下传递、事件向上传递）。不要在组件中直接实现 `fetch`、IndexedDB 或重复的领域转换逻辑。修改前先检查 `git status`，不得覆盖无关用户修改。

## 验证与文档同步

涉及前端代码时，在 `webUI/` 运行：

```bash
npm run typecheck
npm run build
```

涉及 schema、资产恢复或工程传输时，从仓库根目录运行：

```bash
node scripts/validate-p1-regression-fixture.mjs
```

功能、命令、配置、接口、兼容性或目录边界变化时，同步更新 `README.md`、`docs/` 和必要的 P0/P1 文档。规划、旧版行为或后端已具备但前端未调用的能力，不得写成当前 WebUI 功能。
