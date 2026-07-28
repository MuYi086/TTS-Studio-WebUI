# TTS-and-VoiceDesign 接入

本文只描述当前 WebUI 已调用的接口边界。模型路径、Conda（Python 环境管理工具）依赖与完整 API 示例以 [后端 README](https://github.com/MuYi086/TTS-and-VoiceDesign/blob/main/README.md) 为准。

## 启动与健康检查

在后端仓库根目录运行：

```bash
bash start.sh
curl http://127.0.0.1:8300/v1/health
curl http://127.0.0.1:8305/v1/health
curl http://127.0.0.1:8306/v1/health
```

接入 TTS 时，服务需要兼容：

- `GET /v1/check/audio?file_name=...`
- `POST /v1/upload_audio`
- `POST /v2/synthesize`

| 服务 | 端口 | WebUI 协议 | 前端发送的合成关键字段 |
| --- | ---: | --- | --- |
| IndexTTS2 | `8300` | `indextts2` | `audio_path`、`text`、`emo_vector` |
| Qwen3-TTS-12Hz-1.7B-Base | `8305` | `reference-text-clone` | `audio_path`、`text`、`prompt_text` |
| VoxCPM2 | `8306` | `reference-text-clone` | `audio_path`、`text`、`prompt_text` |

WebUI 会按后端默认端口校正协议：`8300` 固定映射为 `indextts2`，`8305` 与 `8306` 固定映射为 `reference-text-clone`。未知端口继续尊重用户手动选择。

## 台词合成中的参考文案

“参考文本克隆”会读取角色音色的 `promptText`。该字段为空时，WebUI 会阻止合成并提示补充参考音频中实际说出的文字。

1. 使用“参考文本克隆”协议时，参考文案为必填；每次台词合成都会从角色当前绑定的同一条音色记录取得 `audio_path` 与 `prompt_text`，并加入 `POST /v2/synthesize` 的 JSON 请求体。
2. 自动补传参考音频时，WebUI 还会把参考文案作为表单字段提交给 `POST /v1/upload_audio`，供后端保存 sidecar（伴随音频保存的文本文件）。
3. IndexTTS2 使用独立的 `indextts2` 协议，不读取或发送 `prompt_text`。

对于支持参考文案的模型，后端优先使用本次合成请求里的 `prompt_text`，再回退到上传时保存的 sidecar。

| 服务 | 后端对 `prompt_text` 的处理 |
| --- | --- |
| IndexTTS2 | 请求模型不声明该字段；官方克隆签名只使用参考音频。 |
| Qwen3-TTS-12Hz-1.7B-Base | 映射为官方 `ref_text`；缺失时退回仅参考音频克隆。 |
| VoxCPM2 | 同时传 `prompt_text`、`prompt_wav_path` 与 `reference_wav_path`，使用 Ultimate Cloning 路径。 |

## 音色设计

默认可选端点：

| 名称 | 接口 | 请求体 |
| --- | --- | --- |
| Qwen | `POST http://127.0.0.1:8300/v1/qwen/design` | `text`、`voice_description` |
| MiMo | `POST http://127.0.0.1:8300/v1/mimo/design` | `text`、`voice_description` |

角色音色分析会优先从结构化脚本中抽取该角色的代表台词和相邻旁白，再生成可复用的 `voice_description`。参考文案与音色生成是两个显式步骤：用户可以检查或编辑参考文案，再点击“生成音色”。生成音色不会再次调用 LLM，只把确认的音色描述作为 `voice_description`、参考文案作为 `text` 提交给 Qwen 或 MiMo。

参考音频必须已获得说话人授权、清晰且仅含一位说话人；参考文案应与实际语音逐字一致，不能写入未朗读的舞台说明、音频标签或 SSML（语音合成标记语言）。生成的参考音频和文案保存在浏览器本地音色库，并作为后续克隆的对应材料。

## `8311` SoundEffect 状态

后端 `8311` 提供 MOSS-SoundEffect v2.0 的 `POST /v1/generate`，请求结束后释放对应 worker 的模型与显存。当前 WebUI 没有该接口的客户端、配置或脚本工作流按钮：可以将独立生成的音效导入 SFX 素材库，但不能宣称 WebUI 已自动生成或自动编排该音效。
