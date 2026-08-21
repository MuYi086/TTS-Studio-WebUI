# TTS Studio WebUI

面向多角色有声书制作的浏览器端工作台。它把原文拆分、角色与参考音色管理、台词合成、BGM 与上下文音效编排、试听和工程备份放在一个本地 WebUI 中。

当前产品形态是“单文件静态 WebUI”：根目录 [`index.html`](index.html) 由 Vue 3、Tailwind CSS 和 `mp4-muxer` CDN 运行，不需要构建。页面通过浏览器直接访问本地或用户配置的兼容服务；模型权重、GPU 推理和后端文件不包含在本仓库中。

## 当前能力

- 模型配置：维护 OpenAI 兼容 LLM（大语言模型）配置，以及 Qwen3-TTS、VoxCPM2、LongCat-AudioDiT 3.5B、dots.tts-soar、FireRedTTS3 本地 TTS 配置。
- 音色资源库：保存参考音频、准确参考文案和音色描述；角色可以绑定库内音色，也可以调用 Qwen、MOSS、MiMo 或 FireRedTTS3 Instruct 生成新的参考音色。
- 脚本制作：支持多个脚本标签、TXT 导入、快速拆分、LLM 深度分析、角色识别、台词与 BGM 时间轴、上下移动、批量生成、顺序播放和停止播放。
- 台词处理：支持角色音量、台词音量、播放速度、波形裁剪、停顿、原始 TTS 音频试听和清除。VoxCPM2 另有极致/可控克隆、表演档位、自然语言控制指令和非语言标签。
- Step-Audio-EditX：以当前行原始音频为首次输入，已有编辑结果时支持继续叠加；编辑结果独立保存，可单独试听、删除、导出和恢复，不替换原始台词音频。
- 上下文音效：LLM 只为原文明确的非语言事件生成 `dialogue.sfx_plan`；每行最多两项，选择 MOSS 或 Stable Audio 生成 WAV 后直接绑定到计划，不经过工程级 SFX 素材库。
- BGM：导入本地音频或调用 ACE-Step 1.5 生成 BGM，剪辑和设置默认音量，在脚本中插入播放/停止控制块；“生成BGM”会按选定模型生成后自动插入并绑定该音频；BGM 与台词、音效一起参与实时预览和 WAV 混音。
- 导出：完整工程 JSON、TXT、SRT 字幕和混音 WAV。MP4 使用 WebCodecs 生成与脚本时长对应的纯黑视频轨道；当前 MP4 只包含视频轨道，不是带 WAV 音轨的最终有声视频。
- Prompt 管理：可编辑脚本分析 Prompt、角色音色分析 Prompt、动态参考文本 Prompt 和固定参考文本策略。默认脚本 Prompt 要求 `emotion` 从 [`editConfig/emotion.js`](editConfig/emotion.js) 的官方标签中选择。

## 界面与代码结构

| 路径 | 职责 |
| --- | --- |
| [`index.html`](index.html) | 唯一开发入口；页面、状态、Prompt、请求、播放、时间轴和导出逻辑 |
| [`js/project-storage.js`](js/project-storage.js) | `unitale-project` schema 4 的工程规范化、迁移和运行时字段清理 |
| [`js/voice-design.js`](js/voice-design.js) | 音色设计服务目录；当前默认 Qwen `8301`、MOSS `8302`、MiMo `8303`、FireRedTTS3 Instruct `8304` |
| [`js/soundeffect-client.js`](js/soundeffect-client.js) | MOSS-SoundEffect 与 Stable Audio 的请求封装 |
| [`js/bgm-client.js`](js/bgm-client.js) | ACE-Step 1.5 BGM 请求封装；生成结果由页面写入现有 IndexedDB 资产链路 |
| [`editConfig/`](editConfig/) | Step-Audio-EditX 的 emotion、paralinguistic、speaking style 词表 |
| [`docs/`](docs/) | 本地开发、回归、后端接入和模型实践说明 |
| [`Design/`](Design/) | 视觉参考图，不参与运行时加载 |

`webUI/` 已废弃且不再是源码目录。`task*.md`、`docs/重构顺序计划.md` 等内容属于任务记录或规划，不能替代当前代码和工程协议。

## 快速开始

需要 Python 3 用于静态文件服务；Node.js 只用于可选的语法检查。仓库没有安装依赖步骤。

```bash
python3 -m http.server 5173
```

然后访问 `http://127.0.0.1:5173/index.html`。也可以使用 VS Code Live Server，仓库配置的端口是 `5502`。

修改后执行内联脚本和外部脚本语法检查：

```bash
node -e "const fs=require('fs');const files=['index.html','js/project-storage.js','js/voice-design.js','js/soundeffect-client.js','js/bgm-client.js','editConfig/emotion.js','editConfig/paralinguistic.js','editConfig/speakingStyle.js'];for(const file of files){const source=fs.readFileSync(file,'utf8');if(file==='index.html'){for(const match of source.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)){if(match[1].trim())new Function(match[1]);}}else new Function(source);console.log('syntax ok:',file)}"
```

没有自动化测试框架；改动页面、存储、播放、音效或导出后应按 [`docs/本地开发与回归.md`](docs/本地开发与回归.md) 在浏览器手动验证。在线模型链路需要真实后端和模型权重，不能用静态检查替代。

## 后端服务

默认后端是 [TTS-and-VoiceDesign](https://github.com/MuYi086/TTS-and-VoiceDesign)。在后端仓库根目录启动：

```bash
bash start.sh
```

WebUI 会自动使用或调用以下本地端点；端口只是当前项目的默认值，用户也可以在页面中保存自定义配置。

| 用途 | 默认端口 | 接口 |
| --- | ---: | --- |
| Qwen3-TTS | `8321` | `POST /v1/qwen/clone`；配套 `/v1/check/audio`、`/v1/upload_audio` |
| VoxCPM2 | `8322` | `POST /v1/voxcpm2/clone`；支持极致/可控克隆字段 |
| LongCat-AudioDiT 3.5B | `8323` | `POST /v1/longCat/clone`；要求参考音频和准确 `prompt_text` |
| dots.tts-soar | `8324` | `POST /v2/dotsTTS/clone`；允许省略 `prompt_text` 的音频克隆协议 |
| FireRedTTS3 Base | `8325` | `POST /v1/FireRedTTS3/clone`；要求参考音频和准确 `prompt_text` |
| 控制面 / 共享工具 | `8300` | `/v1/control`、`/v1/upload_audio`、`/v1/check/audio` |
| Qwen VoiceDesign | `8301` | `POST /v1/qwen/timbre` |
| MOSS VoiceGenerator | `8302` | `POST /v1/moss/timbre` |
| MiMo VoiceDesign | `8303` | `POST /v1/mimo/timbre` |
| FireRedTTS3 Instruct | `8304` | `POST /v1/FireRedTTS3/timbre` |
| MOSS-SoundEffect v2 | `8312` | `POST /v1/moss/soundEffect`，发送中文 `prompt` |
| Stable Audio 3 Medium | `8311` | `POST /v1/stableAudio/soundEffect`，发送英文 `prompt_en` |
| ACE-Step 1.5 XL Turbo | `8313` | `POST /v1/aceStep/bgm`，发送英文音乐 `prompt` |
| Step-Audio-EditX | `8331` | `POST /v1/stepAudioEditx/edit` |

当前台词合成流程如下：

1. 角色必须绑定参考音频路径；Qwen3-TTS、VoxCPM2、LongCat 和 FireRedTTS3 等参考文本协议还要求绑定音频中实际说出的准确文案。
2. 浏览器用 `GET /v1/check/audio` 检查服务端文件；新版服务会比较音频 `sha256`，同名文件内容变化时重新上传。
3. 浏览器按选定模型向 `/v1/qwen/clone`、`/v1/voxcpm2/clone`、`/v1/longCat/clone`、`/v2/dotsTTS/clone` 或 `/v1/FireRedTTS3/clone` 发送 JSON，成功响应必须是非空音频二进制；原始 WAV 同时保存到浏览器 IndexedDB 工程资产。
4. VoxCPM2 的可控克隆只发送 `control_instruction` 和 `nonverbal_tags`，极致克隆发送 `prompt_text`；LongCat 和 FireRedTTS3 不使用 VoxCPM2 的表演字段。

BGM 生成使用独立的 [`js/bgm-client.js`](js/bgm-client.js)，不复用音效客户端：

1. 在“背景音乐管理 (BGM)”的“AI 生成 BGM”表单填写英文音乐描述、时长、可选 BPM/调式/拍号和 Seed；脚本制作页“插入控制块”默认选择产品模型 ID `ace_step_1_5`，也可直接填写描述并点击“生成BGM”。
2. 页面向 `http://127.0.0.1:8313/v1/aceStep/bgm` 发送 JSON；成功响应必须是非空 `audio/wav`，并可通过响应头读取实际 Seed。
3. WAV 立即以 `bgm` `assetKey` 保存到 `UnitaleDB`，登记到现有 `bgmLibrary`，随后复用既有试听、裁剪、时间轴、完整工程导出/导入和离线混音流程。工程 schema 仍为 4。
4. “生成BGM”成功后复用“插入BGM”逻辑创建 `bgm` 控制块，并把本次生成的 `audioAssetKey` 写入控制块；播放和导出优先按该稳定键解析，名称只作为旧工程回退。
5. “停止”只 Abort 浏览器当前等待；不会假装已经终止后端 GPU worker。

LLM 使用用户配置的 OpenAI 兼容 `/chat/completions`。脚本分析是非流式请求，返回严格 JSON 数组；角色分析和参考文案生成也是浏览器直连 LLM，因此云端服务需要允许 CORS，API Key 仅保存在当前浏览器的 `localStorage` 中。

## 音色设计与 Step-Audio-EditX

音色设计目录由 [`js/voice-design.js`](js/voice-design.js) 注入，页面提交：

```json
{
  "voice_description": "用户确认的稳定声线描述",
  "text": "用户确认的参考文案"
}
```

生成的 WAV 会进入本地音色库；随后台词合成仍需要角色绑定这份音色和参考文案。音色设计服务列表可以按目录扩展，不要在 `index.html` 中复制同一份模型清单。

Step-Audio-EditX 使用独立的 8331 服务：

```text
POST http://127.0.0.1:8331/v1/upload_audio
POST http://127.0.0.1:8331/v1/stepAudioEditx/edit
```

前端先上传当前行的原始音频（已有编辑结果时上传上一份编辑结果），再发送 `prompt_text`、`prompt_audio`、`generated_text`、`edit_type: "emotion"` 和当前行的官方 `emotion` 标签。编辑结果使用独立 `stepAudioEditXAudioAssetKey` 保存；删除它不会删除原始 `audioAssetKey`。后端模型、tokenizer、源码和 CUDA 环境的配置与检查方式见 [`docs/TTS-and-VoiceDesign接入.md`](docs/TTS-and-VoiceDesign接入.md)。

## SoundEffect 音效计划

LLM 不生成独立的 `type: "sfx"` 时间轴块，而是在承载事件的 `dialogue` 中写入：

```json
{
  "id": "door_knock_01",
  "purpose": "foreground_action",
  "prompt": "近距离收音，木门被敲击三次，声音短促清晰",
  "prompt_en": "Close-miked wooden door knocked three times, short and crisp. TrackType: SFX",
  "anchor": "dialogue_start",
  "offset_ms": 0,
  "duration_seconds": 1.2,
  "mix_preset": "action_under_dialogue"
}
```

当前工程将计划时长限制为 `0.2–30` 秒。MOSS 使用中文 `prompt`，Stable Audio 只接受同一事件的全英文 `prompt_en`，且 `TrackType: SFX` 必须只在末尾出现一次。返回 WAV 直接写入该计划的 `audioAssetKey`；清空音效会删除生成资产但保留计划，便于重新生成。详细规则见 [`docs/MOSS-SoundEffect自动生成上下文音效.md`](docs/MOSS-SoundEffect自动生成上下文音效.md)。

## 工程数据、备份与兼容性

- 工程元数据和二进制资产保存在浏览器 IndexedDB 的 `UnitaleDB` 中，固定使用 `project.currentState` 和 `assets` 两个对象仓库。
- 当前工程信封为 `kind: "unitale-project"`、`schemaVersion: 4`、`version: "4.0"`。导出 JSON 会嵌入 BGM、音色、台词原音频、EditX 编辑音频和 SoundEffect 音频，导入时自动迁移旧结构。
- 工程导入会覆盖工程资源库和脚本，但不会覆盖 LLM/TTS 模型配置。清理站点数据、更换浏览器或使用无痕窗口前，先导出完整工程。
- `audioUrl`、对象 URL 和取消控制器是运行时字段，不应写入工程；`audioAssetKey` 只是本地资产键，不是静态文件路径。
- 旧 `bgImage`、独立 `sfx` 和 `filter` 字段不属于当前时间轴协议。当前只有 `dialogue` 与 `bgm` 两类块；`break_duration` 仍表示对白后的时间轴停顿。
- Prompt、模型配置、BGM 和界面选择等设置分散保存在旧版兼容 `localStorage` 键中；这些键不能随意重命名或清理。每日 Bing 背景的缓存键只服务于页面展示，不进入工程导出。

## 推荐工作流

1. 启动静态服务，先在“模型配置”中保存 LLM 和 TTS；再确认后端端口和 CORS 可用。
2. 在“音色资源库”导入参考音频，填写逐字准确的参考文案；需要时分析角色声线、生成参考文案并调用 VoiceDesign。
3. 在“脚本制作”导入 TXT 或粘贴原文，先快速拆分或运行 LLM 深度分析。检查角色、`emotion`、BGM 控制块、`sfx_plan` 和 VoxCPM2 表演字段。
4. 选择 TTS 模型，单行或批量生成台词；生成后试听、调整裁剪、速度、音量和停顿。需要情绪编辑时，再为已有原始音频调用 Step-Audio-EditX。
5. 选择 SoundEffect 模型，逐项或批量生成计划音效；确认音效落点、时长和混音预设，再顺序试听脚本。
6. 定期导出完整工程。交付音频使用 WAV；字幕使用 SRT；MP4 当前是纯黑视频轨道，若需要有声视频须在外部后期工具中合成 WAV 音轨。

## 当前限制

- 本地模型、模型权重、GPU、CUDA、后端 CORS 和服务端临时音频目录不属于本仓库；在线链路必须按实际运行环境验证。
- 浏览器直连云端 LLM 可能被 CORS 或浏览器安全策略阻断；不要把 API Key 写进代码或提交到 Git。
- WAV 混音和 MP4 生成依赖 Web Audio API、WebCodecs 以及 CDN 中的 `mp4-muxer` 运行时；MP4 需要支持 `VideoEncoder` 的新版浏览器。
- MP4 当前只生成纯黑画面的视频轨道，不读取旧背景图，也不编码音频轨道。
- 长时间运行的音效、TTS、音色设计和大工程 Base64 导入导出会受到浏览器内存、模型显存和本地服务队列限制。

## 文档导航

- [本地开发与回归](docs/本地开发与回归.md)
- [TTS-and-VoiceDesign 接入](docs/TTS-and-VoiceDesign接入.md)
- [MOSS-SoundEffect 上下文音效](docs/MOSS-SoundEffect自动生成上下文音效.md)
- [VoxCPM2 合成音频最佳实践](docs/VoxCpm2合成音频最佳实践.md)
- [克隆音频响度分析](docs/克隆音频响度分析.md)
- [Agent 协作说明](AGENTS.md)

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。
