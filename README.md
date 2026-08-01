# TTS Studio WebUI

## 单文件 WebUI

面向多角色有声书制作的浏览器端工作台：将原文分析、角色与参考音色、台词合成、音效与背景音乐编排，以及 `SRT`、`WAV`、`MP4` 导出串为一条本地创作流程。

当前开发入口是根目录的 `index.html`，由 Vue 3 CDN 运行时驱动；`project-storage.js` 和 `voice-design.js` 分别提供工程兼容与音色设计目录。`webUI/` 已废弃，不再作为功能开发入口。

## 主要能力

- 用 OpenAI 兼容的 LLM（大语言模型）把小说或剧本拆为 `dialogue`、`bgm`、`bgImage` 三类脚本块；默认分析提示词按自然语义和一口气拆分长文本，中文旁白以 25–45 个汉字为软目标，并可为段间换气设置约 0.1–0.2 秒静音。
- 为角色绑定本地参考音频，或以 Qwen / MiMo 生成参考音色和可编辑的参考文案。
- 在音色、SFX 与 BGM 资源库中显示波形、试听进度和可视化裁剪范围。
- 单行或批量调用本地 TTS（文本转语音）服务；合成前会校验并上传参考音频。
- 在浏览器内混入 SFX、BGM 与滤波器，顺序预览并导出 `SRT`、`WAV`、`MP4`。
- 将工程结构和资产一起导出为 JSON 工程文件，用于备份和恢复。

## 快速开始

在仓库根目录启动静态文件服务器：

```bash
python3 -m http.server 5173
```

访问 `http://127.0.0.1:5173/index.html`。修改后可用 Node.js 执行内联脚本语法检查：

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)){if(match[1].trim())new Function(match[1]);}"
```

## 连接 TTS-and-VoiceDesign

默认本地后端是 [TTS-and-VoiceDesign](https://github.com/MuYi086/TTS-and-VoiceDesign)。在后端仓库根目录启动：

```bash
bash start.sh
```

然后在“模型配置”中保存并选中 LLM 与 TTS 配置。

| 当前 WebUI 台词合成服务 | Base URL | 协议 |
| --- | --- | --- |
| VoxCPM2 | `http://127.0.0.1:8306` | `VoxCPM2（极致 / 可控克隆）` |

`8300` 还提供：

- `POST /v1/qwen/design`
- `POST /v1/mimo/design`
- `POST /v1/voxcpm2/design`

`/v1/voxcpm2/design` 是独立的 VoxCPM2 音色设计接口，不与 Qwen 的 `/v1/qwen/design` 混用。它按 VoxCPM2 官方格式生成无参考音频音色，默认使用 `cfg_value=2.0`、`inference_timesteps=10` 和项目默认 `seed=20260614`。官方示例中的 `seed=42` 用于固定随机结果、方便复现，不代表固定音质提升。

当前 WebUI 的台词合成只会调用 VoxCPM2。每条 `dialogue` 保存 `clone_mode`、`delivery_profile`、`voxcpm_nonverbal_tags` 与 `needs_review`：默认 `ultimate` + `baseline` 会提交准确的 `prompt_text`；选中非基线档位或明确的非语言反应时切换到 `controllable`，提交受限的 `control_instruction`，且不发送 `prompt_text`。非语言标签只允许官方白名单中的一个，出现标签必定标记为需试听；后端会在模型调用前输出最终拼接文本。这两个 VoxCPM2 路径互斥，表演档位不直接控制最终响度。历史 IndexTTS2/Qwen3-TTS 配置会保留在浏览器中供删除，但不会显示在合成选择器、不可编辑，也不会被调用；不会把 `8300` 或 `8305` 自动改写为 `8306`。完整接口契约和排查顺序见 [TTS-and-VoiceDesign 接入](docs/TTS-and-VoiceDesign接入.md)。

新建 TTS 配置固定为 VoxCPM2；本机默认端口为 `8306`。旧端口映射仅用于识别历史配置并将其隔离出当前合成链路。

> 后端 `8311` 的 MOSS-SoundEffect 服务可独立生成音效；当前 WebUI 尚未调用该接口，现有 SFX 来自用户导入的本地素材库。

## 推荐流程

1. 配置并选中 LLM 与 TTS 服务。
2. 导入参考音频、SFX、BGM，维护滤波器和情绪预设。
3. 在“脚本制作”粘贴原文，运行“LLM 深度分析”，检查角色和脚本块；长旁白应优先在自然语义停顿处分段，不要按固定字数硬切。
4. 分析角色音色，生成或编辑参考文案，再通过 Qwen / MiMo / VoxCPM2 生成并绑定参考音色。
5. 预览并调整停顿、音量、滤波器、SFX 与裁剪范围。
6. 定期导出完整工程；最终导出 `SRT`、`WAV` 或 `MP4`。

## 本地数据与备份

- 配置和 Prompt（提示词）保存在浏览器 `localStorage`。
- 每日背景使用独立键 `storyforge_bing_daily_background_date` 与 `storyforge_bing_daily_background_url`；该展示缓存不进入工程文件、`UnitaleDB` 或导出内容。
- 工程与音频、图片资产保存在 IndexedDB（浏览器本地数据库）的 `UnitaleDB`。
- 清理站点数据、更换浏览器或使用无痕窗口前，请先导出完整工程；不要提交包含 API Key 的浏览器数据或截图。

## 文档导航

- [本地开发与回归](docs/本地开发与回归.md)
- [TTS-and-VoiceDesign 接入](docs/TTS-and-VoiceDesign接入.md)
- [Agent 协作说明](AGENTS.md)

## 当前限制

- `MP4` 导出依赖浏览器的 WebCodecs 和固定加载的 `mp4-muxer@5.2.1` 运行时；音轨优先使用 AAC，不支持时回退为 Opus，不能保证所有浏览器均可编码或播放。
- 固定工程的离线端到端回归已记录；LLM、音色设计和 TTS 在线链路仍需连接实际后端服务、模型权重和本机运行环境验证。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。
