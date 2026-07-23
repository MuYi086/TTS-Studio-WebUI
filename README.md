# TTS Studio WebUI

## 单文件 WebUI

面向多角色有声书制作的浏览器端工作台：将原文分析、角色与参考音色、台词合成、音效与背景音乐编排，以及 `SRT`（字幕文件）/ `WAV`（波形音频文件）/ `MP4`（视频文件）导出串为一条本地创作流程。

当前开发入口是根目录 [`index.html`](index.html)，由 Vue 3 CDN（内容分发网络）运行时驱动；[`project-storage.js`](project-storage.js) 和 [`voice-design.js`](voice-design.js) 分别提供工程兼容与音色设计目录。`webUI/` 已废弃，不再作为功能开发入口。

## 主要能力

- 用 OpenAI 兼容的 LLM（大语言模型）把小说或剧本拆为 `dialogue`、`bgm`、`bgImage` 三类脚本块。
- 为角色绑定本地参考音频，或先由 LLM 根据角色音色与上下文生成可编辑的参考文案，再使用确认后的音色描述和参考文案通过 Qwen / MiMo 生成参考音色。
- 在音色、SFX 与 BGM 资源库中显示真实波形和试听进度，并以可视化手柄维护音频裁剪范围。
- 单行或批量调用本地 TTS（文本转语音）服务；合成前会校验并上传参考音频。
- 在浏览器内混入 SFX（场景音效）、BGM（背景音乐）与滤波器，顺序预览并导出 `SRT`、`WAV`、`MP4`。
- 将工程结构和资产一起导出为 JSON（JavaScript 对象表示法）工程文件，用于备份和恢复。

## 快速开始

在仓库根目录启动一个静态文件服务器：

```bash
python3 -m http.server 5173
```

然后访问 `http://127.0.0.1:5173/index.html`。修改后可用 Node.js 执行内联脚本语法检查：

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)){if(match[1].trim())new Function(match[1]);}"
```

## 连接 TTS-and-VoiceDesign

默认本地后端是 [TTS-and-VoiceDesign](https://github.com/MuYi086/TTS-and-VoiceDesign)。在后端仓库根目录启动：

```bash
bash start.sh
```

然后在“模型配置”中保存并选中 LLM 与 TTS 配置。LLM 的 `Base URL` 可填 API 根路径或完整 `/chat/completions` 地址；前端会在需要时补齐路径。

| 后端服务 | Base URL | WebUI 协议 |
| --- | --- | --- |
| IndexTTS2 | `http://127.0.0.1:8300` | `IndexTTS2（仅传音频与情绪向量）` |
| dots.tts-base | `http://127.0.0.1:8301` | `参考文本克隆（传 prompt_text）` |
| LongCat-AudioDiT-1B | `http://127.0.0.1:8302` | `参考文本克隆（传 prompt_text）` |
| MOSS-TTS-Local-Transformer | `http://127.0.0.1:8303` | `参考文本克隆（传 prompt_text）` |
| OmniVoice | `http://127.0.0.1:8304` | `参考文本克隆（传 prompt_text）` |
| Qwen3-TTS-12Hz-1.7B-Base | `http://127.0.0.1:8305` | `参考文本克隆（传 prompt_text）` |
| VoxCPM2 | `http://127.0.0.1:8306` | `参考文本克隆（传 prompt_text）` |

`8300` 默认还提供：

- `POST /v1/qwen/design`
- `POST /v1/mimo/design`

参考文本克隆需要角色的参考音频文本。脚本台词生成会把当前绑定音色的准确参考文案作为 `prompt_text` 提交给对应克隆模型；IndexTTS2 的官方克隆接口不使用参考转写，继续只发送参考音频与情绪向量。完整的模型能力、接口契约和排查顺序见 [TTS-and-VoiceDesign 接入](docs/TTS-and-VoiceDesign接入.md)。

> 后端的 MOSS-SoundEffect `8311` 服务可独立生成音效，但当前 WebUI 尚未调用该接口；现有 SFX 来自用户导入的本地素材库。

## 推荐流程

1. 配置并选中 LLM 与 TTS 服务。
2. 导入参考音频、SFX、BGM，维护滤波器和情绪预设。
3. 在“脚本制作”粘贴原文，运行“LLM 深度分析”，检查角色和脚本块。
4. 分析角色音色，点击“生成参考文案”并按需编辑文本，再点击“生成音色”，通过 Qwen / MiMo 生成并绑定参考音色。
5. 预览并调整停顿、音量、滤波器、SFX 与裁剪范围。
6. 定期导出完整工程；最终导出 `SRT`、`WAV` 或 `MP4`。

## 本地数据与备份

- 配置和 Prompt（提示词）保存在浏览器 `localStorage`（本地键值存储）。
- 工程与音频、图片资产保存在 IndexedDB（浏览器本地数据库）的 `UnitaleDB`。
- 清理站点数据、更换浏览器或使用无痕窗口前，请先导出完整工程；不要提交包含 API Key（接口密钥）的浏览器数据或截图。

## 文档导航

- [本地开发与回归](docs/本地开发与回归.md)
- [TTS-and-VoiceDesign 接入](docs/TTS-and-VoiceDesign接入.md)
- [Agent 协作说明](AGENTS.md)

## 当前限制

- `MP4` 导出依赖浏览器的 WebCodecs（网页编解码接口）和页面固定加载的 `mp4-muxer@5.2.1` 运行时；音轨优先使用 AAC，不支持时回退为 Opus，但仍不能保证所有浏览器均可编码或播放。
- 固定工程的离线端到端回归已记录；LLM、音色设计和 TTS 在线链路仍需连接实际 `TTS-and-VoiceDesign` 服务、模型权重和本机运行环境验证。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。
