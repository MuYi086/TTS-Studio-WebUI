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

返回音频会写入浏览器本地音色库，再按当前 TTS 配置同步。

## `8311` SoundEffect 状态

后端 `8311` 提供 MOSS-SoundEffect v2.0 的 `POST /v1/generate`，请求结束后释放相应 worker 的模型与显存。当前 WebUI 没有该接口的客户端、配置或脚本工作流按钮：可以将独立生成的音效导入 SFX 素材库，但不能宣称 WebUI 已自动生成或自动编排该音效。
