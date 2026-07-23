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

### 台词合成中的参考文案

脚本工作台点击单条台词的“生成音频”按钮时，`generateLineAudio` 会从角色当前绑定的音色记录读取参考文案，并按以下边界传递：

1. 使用“参考文本克隆”协议时，参考文案为必填；每次台词合成都会把它作为 `prompt_text` 加入 `POST /v2/synthesize` 的 JSON 请求体。
2. 自动补传参考音频时，WebUI 还会把参考文案作为表单字段提交给 `POST /v1/upload_audio`，供后端保存 sidecar。
3. IndexTTS2 使用独立的 `indextts2` 协议，不读取或发送 `prompt_text`。

对于支持参考文案的模型，后端以本次合成请求里的 `prompt_text` 为第一优先级，再回退到上传时保存的 sidecar（伴随音频保存的文本文件）。各服务最终处理方式如下：

| 服务 | 后端对 `prompt_text` 的处理 |
| --- | --- |
| IndexTTS2 | 请求模型不声明该字段；官方 `IndexTTS2.infer` 克隆签名只使用 `spk_audio_prompt` |
| dots.tts-base | 原样传给官方 `DotsTtsRuntime.generate(prompt_text=...)`；官方推荐参考音频与准确转写配对 |
| LongCat-AudioDiT-1B | 原样传入并与目标文本拼接；缺失时可按后端配置自动转写 |
| MOSS-TTS-Local-Transformer | 有文案时走官方 continuation 克隆（参考转写 + 目标文本 + 前缀音频）；缺失时保留 reference 音频克隆 |
| OmniVoice | 映射为模型的 `ref_text`；缺失时可使用本地 ASR（自动语音识别） |
| Qwen3-TTS-12Hz-1.7B-Base | 映射为官方 `ref_text`；缺失时退回 `x-vector-only`，音色克隆质量可能降低 |
| VoxCPM2 | 同时传 `prompt_text`、`prompt_wav_path` 与 `reference_wav_path`，使用官方 Ultimate Cloning 路径 |

能力依据均来自模型维护方资料：[IndexTTS2](https://github.com/index-tts/index-tts)、[dots.tts-base](https://huggingface.co/rednote-hilab/dots.tts-base)、[LongCat-AudioDiT](https://github.com/meituan-longcat/LongCat-AudioDiT)、[MOSS-TTS-Local-Transformer-v1.5](https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Local-Transformer-v1.5)、[OmniVoice](https://github.com/k2-fsa/OmniVoice)、[Qwen3-TTS Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base) 和 [VoxCPM2](https://huggingface.co/openbmb/VoxCPM2)。

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
