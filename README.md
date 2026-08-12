# TTS Studio WebUI

## 单文件 WebUI

面向多角色有声书制作的浏览器端工作台：将原文分析、角色与参考音色、台词合成、音效与背景音乐编排，以及 `SRT`、`WAV`、`MP4` 导出串为一条本地创作流程。

当前开发入口是根目录的 `index.html`，由 Vue 3 CDN 运行时驱动；`project-storage.js`、`voice-design.js` 和 `soundeffect-client.js` 分别提供工程兼容、音色设计目录和 SoundEffect 请求封装。`webUI/` 已废弃，不再作为功能开发入口。

## 主要能力

- 用 OpenAI 兼容的 LLM（大语言模型）把小说或剧本拆为 `dialogue`、`bgm` 两类脚本块；默认分析提示词按自然语义和一口气拆分长文本，中文旁白以 25–45 个汉字为软目标，并可为段间换气设置约 0.1–0.2 秒静音。原文明确的非语言事件写入台词内 `sfx_plan`，每项同时保存 MOSS-SoundEffect 的中文 `prompt` 与 Stable Audio 3 Small-SFX 的英文 `prompt_en`，再按选定模型生成对应 WAV。
- “配音与播放”提供可控克隆选择，默认“关闭可控克隆”：LLM（大语言模型）剧本分析会使用极致克隆提示词，把全部台词收敛为 `ultimate`；显式选择“开启可控克隆”后才使用可控克隆提示词，按需规划 `ultimate` / `controllable` 和表演档位。非语言标签只在原文明示可听见的对应发声时输出，不能由标点或情绪猜测。详见 [VoxCPM2 合成音频最佳实践](VoxCpm2合成音频最佳实践.md)。
- 为角色绑定本地参考音频，或以 Qwen / MiMo 生成参考音色和可编辑的参考文案。
- 在音色与 BGM 资源库中显示波形、试听进度和可视化裁剪范围；SoundEffect 音效则在对应台词计划上生成和试听。
- 单行或批量调用本地 TTS（文本转语音）服务；合成前会校验并上传参考音频。
- 剧本的 `emotion` 默认使用 Step-Audio-EditX 官方情绪标签；可将已生成的单行音频按该标签再次编辑，并保留原始与编辑结果供分别试听、删除和工程恢复。
- 在浏览器内混入 SoundEffect 生成的音效与 BGM，顺序预览并导出 `SRT`、`WAV`、`MP4`。
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
| Qwen3-TTS Base | `http://127.0.0.1:8305` | `Qwen3-TTS（参考文本克隆）` |
| VoxCPM2 | `http://127.0.0.1:8306` | `VoxCPM2（极致 / 可控克隆）` |
| Ming-omni-tts 0.5B | `http://127.0.0.1:8306` | `Ming（参考文本克隆）` |
| LongCat-AudioDiT-3.5B-bf16 | `http://127.0.0.1:8307` | `LongCat（参考文本声音克隆）` |

`8300` 还提供：

- `POST /v1/qwen/design`
- `POST /v1/mimo/design`
- `POST /v1/voxcpm2/design`
- `POST /v1/step-audio-editx/edit`

`/v1/voxcpm2/design` 是独立的 VoxCPM2 音色设计接口，不与 Qwen 的 `/v1/qwen/design` 混用。它按 VoxCPM2 官方格式生成无参考音频音色，`cfg_value` 与克隆请求统一由后端顶部的 `VOXCPM2_CFG_VALUE` 控制（官方 Demo 默认 `2.0`），`inference_timesteps=10`。项目默认不固定随机种子，只有复现实验时才显式传非负 `seed`；官方示例中的 `seed=42` 也只用于固定随机结果，不代表固定音质提升。

当前 WebUI 的台词合成会根据“配音与播放”中的模型选择调用 Qwen3-TTS、VoxCPM2、Ming 或 LongCat 的固定 `POST /v2/synthesize` 接口。后端每次本地 TTS 合成成功后还会把原始 WAV 同步保存到 `TTS-and-VoiceDesign/api/tempAudio/`，便于直接试听和排查；该归档不改变浏览器 IndexedDB 中的工程音频。VoxCPM2 每条 `dialogue` 保存 `clone_mode`、`delivery_profile`、`control_instruction`、`voxcpm_nonverbal_tags` 与 `needs_review`；LongCat 使用同一角色参考音频和准确的 `prompt_text`，不发送 VoxCPM2 表演字段。脚本制作页默认“关闭可控克隆”，此时 VoxCPM2 仍统一使用 `ultimate`；只有选择“开启可控克隆”才保留逐句路由。LongCat-AudioDiT-3.5B 运行在 `8307`，官方克隆路径要求 CUDA、24 kHz 单声道参考音频和逐字准确的参考文本，默认 16 步 APG，并受模型的最大总时长限制。参考音频同步按 Blob 内容 `sha256` 校验，同名文件内容更新后会重新上传。完整接口契约和排查顺序见 [TTS-and-VoiceDesign 接入](docs/TTS-and-VoiceDesign接入.md)。

Step-Audio-EditX 编辑按钮第一次使用当前行已生成的原始音频作为 `prompt_audio`；如果该行已有编辑结果，则后续点击优先使用最近一次编辑结果作为新的 `prompt_audio`，支持二次、三次及连续叠加编辑。每次点击都会先上传当前 prompt 音频，并生成唯一的 `step-audio-editx/<line-id>_<timestamp>_<nonce>.wav` 路径，避免后端按相同路径复用旧文件。请求仍使用当前行文本作为 `prompt_text` 和 `generated_text`，并发送 `edit_type="emotion"`、`edit_info=line.emotion`。首次点击前必须先生成原始台词，且 `emotion` 必须是 [`editConfig/emotion.js`](editConfig/emotion.js) 中的官方标签。编辑结果以独立资产键保存，不会替换原始台词音频；清除编辑结果后，下一次点击会重新从原始台词开始。

本机默认提供 Qwen3-TTS（`8305`）、VoxCPM2（`8306`）、Ming-omni-tts（`8306`）和 LongCat-AudioDiT-3.5B（`8307`）内置配置；用户选择的模型会直接决定台词合成服务。旧配置仍保留在浏览器中，但不会被静默改写或调用。

> SoundEffect 下拉框提供 MOSS-SoundEffect v2（`8311`）和 Stable Audio 3 Small-SFX（`8312`）。LLM 分析会为每个明确事件写入双语 `sfx_plan`：选择 MOSS 时，WebUI 向 `8311/v1/generate` 发送中文 `prompt`；选择 Stable Audio 时，向 `8312/v1/generate` 发送全英文且以 `TrackType: SFX` 结尾的 `prompt_en`。旧工程缺少 `prompt_en` 时仍可用 MOSS；Stable Audio 会提示重新运行 AI 深度分析，而不会把中文提示词发送给英文模型。生成的 WAV 会立即保存到浏览器 IndexedDB（浏览器本地数据库）工程资产，刷新页面后按 `audioAssetKey` 自动恢复。页面不提供 SFX 素材库或本地音效导入回退路径。

## 推荐流程

1. 配置并选中 LLM 与 TTS 服务。
2. 导入参考音频与 BGM，维护情绪预设。
3. 在“脚本制作”粘贴原文；默认“关闭可控克隆”，如需 LLM 按台词规划可控克隆，先选择“开启可控克隆”，再运行“LLM 深度分析”。检查角色和脚本块；长旁白应优先在自然语义停顿处分段，不要按固定字数硬切。
4. 分析角色音色，生成或编辑参考文案，再通过 Qwen / MiMo / VoxCPM2 生成并绑定参考音色；台词合成时可在模型下拉框选择 LongCat-AudioDiT。
5. 在台词卡片生成并试听 `sfx_plan` 的 SoundEffect 音效，再调整停顿、音量与裁剪范围；需要重新生成前可点击“清空所有音效”删除当前脚本的音效缓存和生成记录（保留音效计划）；需要强化情绪时，先生成单行原音频，再点击“使用Step-Audio-EditX”试听编辑结果。若要叠加效果，可连续点击该按钮；清除编辑结果即可回到原始音频基线。
6. 定期导出完整工程；最终导出 `SRT`、`WAV` 或 `MP4`。

## 本地数据与备份

- 配置和 Prompt（提示词）保存在浏览器 `localStorage`。
- 每日背景使用独立键 `storyforge_bing_daily_background_date` 与 `storyforge_bing_daily_background_url`；该展示缓存不进入工程文件、`UnitaleDB` 或导出内容。
- 工程与音频资产保存在 IndexedDB（浏览器本地数据库）的 `UnitaleDB`。
- 生成的台词、Step-Audio-EditX 与 SoundEffect 音频按稳定 `audioAssetKey` 从 `UnitaleDB.assets` 恢复；稳定键不是 `/voice/` 静态文件路径，只有旧版真实文件名/路径才会执行静态文件回退。
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
