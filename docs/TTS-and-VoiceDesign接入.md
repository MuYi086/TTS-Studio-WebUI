# TTS-and-VoiceDesign 接入

本文只描述当前 WebUI 已调用的接口边界。模型路径、Conda（Python 环境管理工具）依赖与完整 API（应用程序接口）示例以 [后端 README](https://github.com/MuYi086/TTS-and-VoiceDesign/blob/main/README.md) 为准。

## 启动与健康检查

在后端仓库根目录运行：

```bash
bash start.sh
curl http://127.0.0.1:8300/v1/health
```

默认启动 `8300` 至 `8306`，以及 `8311`。接入 TTS 时，服务需要兼容：

- `GET /v1/check/audio?file_name=...`
- `POST /v1/upload_audio`
- `POST /v2/synthesize`

| 服务 | 端口 | WebUI 协议 | 前端发送的合成关键字段 |
| --- | ---: | --- | --- |
| IndexTTS2 | `8300` | `indextts2` | `audio_path`、`text`、`emo_vector` |
| dots.tts-base | `8301` | `reference-text-clone` | `audio_path`、`text`、`prompt_text` |
| LongCat-AudioDiT-1B | `8302` | `reference-text-clone` | `audio_path`、`text`、`prompt_text` |
| MOSS-TTS-Local-Transformer | `8303` | `reference-text-clone` | `audio_path`、`text`、`prompt_text` |
| OmniVoice | `8304` | `reference-text-clone` | `audio_path`、`text`、`prompt_text` |
| Qwen3-TTS-12Hz-1.7B-Base | `8305` | `reference-text-clone` | `audio_path`、`text`、`prompt_text` |
| VoxCPM2 | `8306` | `reference-text-clone` | `audio_path`、`text`、`prompt_text` |

“参考文本克隆”会读取角色音色的 `promptText`。该字段为空时，WebUI 会阻止合成并提示补充参考音频中实际说出的文字。

## 音色设计

默认可选端点：

| 名称 | 接口 | 请求体 |
| --- | --- | --- |
| Qwen | `POST http://127.0.0.1:8300/v1/qwen/design` | `text`、`voice_description` |
| MiMo | `POST http://127.0.0.1:8300/v1/mimo/design` | `text`、`voice_description` |

角色音色分析会优先从结构化脚本中抽取该角色的代表台词和相邻旁白，再生成可复用的 `voice_description`。参考文案与音色生成是两个显式步骤：点击“生成参考文案”后，前端使用当前 LLM，根据角色名、音色描述和角色上下文生成文本并写入角色卡片的“参考文案”文本框；用户可以检查或编辑文本，再点击“生成音色”。“生成音色”不会再次调用 LLM，只把当时确认的音色描述作为 `voice_description`、参考文案作为 `text` 提交给 Qwen 或 MiMo。

返回音频会写入浏览器本地音色库，再按当前 TTS 配置同步。实际提交给音色设计接口的 `text` 会原样保存为角色的 `voicePromptText` 和音色的 `promptText`，供工程恢复与参考文本克隆使用；因此参考文案不得包含不会被念出的舞台说明、音频标签或 SSML（语音合成标记语言）。

Prompt 管理继续兼容旧键 `storyforge_qwen_voice_text_template` 和 `storyforge_use_custom_qwen_voice_text`，并新增：

- `storyforge_voice_reference_prompt_template`：角色专属参考文本的 LLM Prompt。
- `storyforge_use_dynamic_voice_reference_text`：是否启用动态参考文本。

旧版中已经启用自定义 Qwen 固定文本的用户，在首次升级且不存在新开关键时会继续使用固定模式；其他用户默认启用动态模式。未配置 LLM 时，动态模式会安全回退到固定文本。

## `8311` SoundEffect 状态

后端 `8311` 提供 MOSS-SoundEffect v2.0 的 `POST /v1/generate`，请求结束后释放相应 worker 的模型与显存。当前 WebUI 没有该接口的客户端、配置或脚本工作流按钮：可以将独立生成的音效导入 SFX 素材库，但不能宣称 WebUI 已自动生成或自动编排该音效。
