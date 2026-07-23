# TTS Studio WebUI Agent 协作指南

## 阅读顺序与语言

修改代码、数据、文档或资产前，依次阅读 [CONSTITUTION.md](CONSTITUTION.md)、本文件和任务直接相关的源码、配置、测试与文档。面向用户和贡献者的文档、总结、评审意见和代理输出默认中文优先；必要英文术语首次出现时补中文说明。

## 仓库边界

- 当前开发入口是根目录 [`index.html`](index.html)，应用采用 Vue 3 CDN 单文件实现；`project-storage.js` 和 `voice-design.js` 是当前页面的配套模块。
- [`webUI/`](webUI/) 已废弃，不要把新功能写入或恢复到该目录。
- 音色设计默认目录由根目录 [`voice-design.js`](voice-design.js) 提供。
- 本地后端是独立仓库 [TTS-and-VoiceDesign](https://github.com/MuYi086/TTS-and-VoiceDesign)；前端接入边界见 [`docs/TTS-and-VoiceDesign接入.md`](docs/TTS-and-VoiceDesign接入.md)。

## 兼容性与职责

改动存储、工程导入导出、模型调用或音频时间轴前，必须先读 [`webUI/P0-兼容性红线.md`](webUI/P0-兼容性红线.md)。不得破坏 `UnitaleDB`、旧 `localStorage` 键、工程 schema、资产键和 `dialogue` / `bgm` / `bgImage` 的时间轴语义。

当前应用仍集中在 `index.html`，修改时按“配置与 Prompt、存储兼容、模型调用、播放导出、页面展示”分区维护，不要把同一转换逻辑复制到多个函数。工程导入导出和 IndexedDB 兼容逻辑优先复用 `project-storage.js`，音色设计目录优先复用 `voice-design.js`。修改前先检查 `git status`，不得覆盖无关用户修改。

## 验证与文档同步

涉及根目录单文件前端代码时，至少运行内联脚本语法检查：

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)){if(match[1].trim())new Function(match[1]);}"
```

涉及 schema、资产恢复或工程传输时，从仓库根目录运行：

```bash
node scripts/validate-p1-regression-fixture.mjs
```

功能、命令、配置、接口、兼容性或目录边界变化时，同步更新 `README.md`、`docs/` 和必要的 P0/P1 文档。规划、旧版行为或后端已具备但前端未调用的能力，不得写成当前 WebUI 功能。
