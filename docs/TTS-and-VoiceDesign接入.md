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

| 当前 WebUI 合成服务 | 端口 | WebUI 协议 | 前端发送的合成关键字段 |
| --- | ---: | --- | --- |
| VoxCPM2 | `8306` | `voxcpm2` | `audio_path`、`text`、`clone_mode`，再二选一传 `prompt_text` 或 `control_instruction`，以及 `nonverbal_tags` |

WebUI 新建 TTS 配置固定为 `voxcpm2`。`8300` 与 `8305` 的历史配置会保留在浏览器中，但不出现在当前合成选择器、不可编辑且绝不会被调用；页面不会把它们静默改为 `8306`。后端仍保留这些服务，供其自身兼容场景使用。

## 台词合成中的参考文案与 VoxCPM2 表演计划

1. VoxCPM2 的每条台词保存 `clone_mode`（`ultimate` 或 `controllable`）、`delivery_profile`（`baseline`、`expressive`、`suspense`、`fear`、`urgent`、`restrained`）、`voxcpm_nonverbal_tags`（最多一个官方标签）与 `needs_review`。
2. `ultimate` + `baseline` 要求角色绑定的准确参考文案，并发送 `prompt_text`；`controllable` 发送固定档位产生的短 `control_instruction`，不发送 `prompt_text` 或 sidecar。
3. `nonverbal_tags` 是后端请求字段，来自工程字段 `voxcpm_nonverbal_tags`。允许 `laughing`、`sigh`、`Uhm`、`Shh`、`Question-ah`、`Question-ei`、`Question-en`、`Question-oh`、`Surprise-wa`、`Surprise-yo`、`Dissatisfaction-hnn`；标签只能在原文明确有可听见反应时使用，不得写入正文或参考文案。标签强制 `controllable`、默认 `expressive` 并将 `needs_review` 设为 `true`。
4. 后端对每个文本分片将最终模型文本拼成 `(control_instruction)[tag]正文`，并在调用模型前向终端输出该文本、分片序号和克隆模式；不输出参考音频转写。
5. `needs_review` 只是人工试听标记，不参与模型参数。`delivery_profile` 只控制表演方式，不保证或直接设定最终响度；成片响度仍应在合成后统一检测和归一化。

VoxCPM2 的 Ultimate Cloning 后端优先使用本次合成请求里的 `prompt_text`，再回退到上传时保存的 sidecar；可控克隆不会读取或传递 sidecar。

## 音色设计

默认可选端点：

| 名称 | 接口 | 请求体 |
| --- | --- | --- |
| Qwen | `POST http://127.0.0.1:8300/v1/qwen/design` | `text`、`voice_description` |
| MiMo | `POST http://127.0.0.1:8300/v1/mimo/design` | `text`、`voice_description` |
| VoxCPM2 | `POST http://127.0.0.1:8300/v1/voxcpm2/design` | `text`、`voice_description` |

VoxCPM2 使用独立的 `/v1/voxcpm2/design` 路由，不与 Qwen 音色设计接口混用。后端由专用模块和 worker 将请求转换为官方格式 `(音色描述)正文`，不需要参考音频，默认使用 `cfg_value=2.0`、`inference_timesteps=10`。官方文档示例写死 `seed=42` 是为了复现实验结果，并不表示该值具有特殊音质增益；项目统一继续使用 VoxCPM2 默认种子 `20260614`，需要对比或复现单次样本时才显式传入 `seed`。

角色音色分析会优先从结构化脚本中抽取该角色的代表台词和相邻旁白，再生成可复用的 `voice_description`。参考文案与音色生成是两个显式步骤：用户可以检查或编辑参考文案，再点击“生成音色”。生成音色不会再次调用 LLM，只把确认的音色描述作为 `voice_description`、参考文案作为 `text` 提交给 Qwen、MiMo 或 VoxCPM2。

参考音频必须已获得说话人授权、清晰且仅含一位说话人；参考文案应与实际语音逐字一致，不能写入未朗读的舞台说明、音频标签或 SSML（语音合成标记语言）。生成的参考音频和文案保存在浏览器本地音色库，并作为后续克隆的对应材料。

## `8311` SoundEffect 状态

后端 `8311` 提供 MOSS-SoundEffect v2.0 的 `POST /v1/generate`，请求结束后释放对应 worker 的模型与显存。当前 WebUI 没有该接口的客户端、配置或脚本工作流按钮：可以将独立生成的音效导入 SFX 素材库，但不能宣称 WebUI 已自动生成或自动编排该音效。
