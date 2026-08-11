# TTS-and-VoiceDesign 接入

本文只描述当前 WebUI 已调用的接口边界。模型路径、Conda（Python 环境管理工具）依赖与完整 API 示例以 [后端 README](https://github.com/MuYi086/TTS-and-VoiceDesign/blob/main/README.md) 为准。

## 启动与健康检查

在后端仓库根目录运行：

```bash
bash start.sh
curl http://127.0.0.1:8300/v1/health
curl http://127.0.0.1:8305/v1/health
curl http://127.0.0.1:8306/v1/health
curl http://127.0.0.1:8307/v1/health
```

接入 TTS 时，服务需要兼容：

- `GET /v1/check/audio?file_name=...`
- `POST /v1/upload_audio`
- `POST /v2/synthesize`

| 当前 WebUI 合成服务 | 端口 | WebUI 协议 | 前端发送的合成关键字段 |
| --- | ---: | --- | --- |
| VoxCPM2 | `8306` | `voxcpm2` | `audio_path`、`text`、`backend="voxcpm2"`、`clone_mode`，再按模式二选一传 `prompt_text` 或 `control_instruction`，以及 `nonverbal_tags`；`cfg_value` 由后端 `VOXCPM2_CFG_VALUE` 统一控制 |
| LongCat-AudioDiT-3.5B-bf16 | `8307` | `longcat-audiodit` | `audio_path`、`text`、准确的 `prompt_text`；worker 按官方接口拼接参考文本与目标文本，并使用 24 kHz 单声道参考音频 |

WebUI 会为 Qwen3-TTS、VoxCPM2、Ming-omni-tts 和 LongCat-AudioDiT 创建内置 TTS 配置；用户在脚本工作台的 TTS 下拉框中选中的配置决定当前台词请求的 Base URL 与后端模型。历史配置会保留在浏览器中，但只有协议可识别的本地模型才进入当前合成选择器，页面不会把旧端口静默改写为其他模型。

四个本地 TTS 模型成功返回 WAV 后，后端还会将同一份原始音频同步保存到 `TTS-and-VoiceDesign/api/tempAudio/`；这与浏览器 IndexedDB 的工程资产保存相互独立，不会改变页面播放和导出流程。

## 台词合成中的参考文案与 VoxCPM2 表演计划

1. VoxCPM2 的每条台词保存 `clone_mode`（`ultimate` 或 `controllable`）、`delivery_profile`（`baseline`、`expressive`、`suspense`、`fear`、`urgent`、`restrained`）、`control_instruction`、`voxcpm_nonverbal_tags`（最多一个官方标签）与 `needs_review`。
2. `ultimate` + `baseline` 要求角色绑定的准确参考文案，并向固定的 `/v2/synthesize` 发送 `clone_mode="ultimate"` 与 `prompt_text`；`controllable` 发送 `backend="voxcpm2"`、`clone_mode="controllable"`、脚本括号内自然语言生成的 `control_instruction` 与 `nonverbal_tags`，明确省略 `prompt_text` 和 sidecar。`text_content`（页面字段 `text`）只保存括号外正文，`control_instruction` 不带外层括号。
3. `nonverbal_tags` 是后端请求字段，来自工程字段 `voxcpm_nonverbal_tags`。允许 `laughing`、`sigh`、`Uhm`、`Shh`、`Question-ah`、`Question-ei`、`Question-en`、`Question-oh`、`Surprise-wa`、`Surprise-yo`、`Dissatisfaction-hnn`；标签只能在原文明确有可听见反应时使用，不得写入正文或参考文案。标签强制 `controllable`、默认 `expressive` 并将 `needs_review` 设为 `true`。
4. 后端对每个文本分片将最终模型文本拼成 `(control_instruction)[tag]正文`，并在调用模型前向终端输出该文本、分片序号和克隆模式；不输出参考音频转写。
5. `needs_review` 只是人工试听标记，不参与模型参数。`delivery_profile` 只控制表演方式，不保证或直接设定最终响度；成片响度仍应在合成后统一检测和归一化。
6. 脚本制作页的可控克隆选择默认“关闭可控克隆”。关闭时，前端会把极致克隆约束附加到 LLM 分析请求，并在解析结果及“一键生成配音”开始前强制目标 `dialogue` 使用 `ultimate`、`baseline`、空 `control_instruction`、空 `voxcpm_nonverbal_tags` 和 `needs_review=false`。只有显式选择“开启可控克隆”才保留逐句 `controllable` 路由。

VoxCPM2 的 Ultimate Cloning 后端优先使用本次合成请求里的 `prompt_text`，再回退到上传时保存的 sidecar；可控克隆不会读取或传递 sidecar。

LongCat-AudioDiT 只走参考音频克隆路径，不支持 VoxCPM2 的 `clone_mode`、`control_instruction` 或 `nonverbal_tags` 表演字段。它要求 `prompt_text` 与参考音频逐字一致；WebUI 会把角色绑定的参考文案作为 `prompt_text`，先上传参考音频和 sidecar，再请求 `POST http://127.0.0.1:8307/v2/synthesize`。模型只接受 CUDA，官方示例默认使用 16 步、APG guidance（自适应投影引导），并受模型配置的 `max_wav_duration` 总时长上限约束。

参考音频同步不能只依赖 `file_name` 是否存在：WebUI 会计算本地 Blob 的 `sha256`，并与 `GET /v1/check/audio` 返回的服务端哈希比较；同名但内容已变化时会重新上传，避免使用旧参考音频。

## Step-Audio-EditX 单行编辑

WebUI 将 Step-Audio-EditX 作为原始台词生成后的独立编辑步骤，不替换 `audioAssetKey` 对应的原始音频。第一次点击“使用Step-Audio-EditX”时，浏览器会把当前行播放按钮绑定的原始音频上传到主服务 `8300`；该行已有编辑结果时，后续点击改为上传最近一次编辑结果，因此支持二次、三次及连续叠加编辑。每次点击都会生成唯一的 `step-audio-editx/<line-id>_<timestamp>_<nonce>.wav` 作为上传路径，避免后端按相同 `prompt_audio` 路径复用旧文件。每次请求都使用当前行文本作为 `prompt_text` 和 `generated_text`。清除编辑结果后，下一次点击回退到原始台词音频。当前页面的按钮固定发送：

```json
{
  "prompt_audio": "step-audio-editx/<line-id>_<timestamp>_<nonce>.wav",
  "prompt_text": "当前行文本",
  "generated_text": "当前行文本",
  "edit_type": "emotion",
  "edit_info": "coldness"
}
```

接口是 `POST http://127.0.0.1:8300/v1/step-audio-editx/edit`。其中 `prompt_audio` 必须先经 `POST /v1/upload_audio` 上传，`edit_type` 和 `edit_info` 是 JSON 字段名，分别对应官方 CLI 的 `--edit-type`、`--edit-info`。当前前端仅自动发起 `emotion` 编辑，`edit_info` 必须来自 [`editConfig/emotion.js`](../editConfig/emotion.js)；后端同时接受官方的 `style`、`paralinguistic`、`denoise`、`vad` 和 `speed` 类型。编辑结果保存到 `stepAudioEditXAudioAssetKey`，可独立试听、删除、导出和导入；原始音频与最近一次编辑结果始终分别保存。

后端需配置 `STEP_AUDIO_EDITX_CONDA_ENV`、`STEP_AUDIO_EDITX_MODEL_DIR`、`STEP_AUDIO_TOKENIZER_PATH` 与 `STEP_AUDIO_EDITX_CODE_PATH`。`GET /v1/health` 的 `available.step_audio_editx` 可检查模型、tokenizer、源码与 worker 文件是否齐备；它不替代实际 CUDA/vLLM 推理验证。

## 音色设计

默认可选端点：

| 名称 | 接口 | 请求体 |
| --- | --- | --- |
| Qwen | `POST http://127.0.0.1:8300/v1/qwen/design` | `text`、`voice_description` |
| MiMo | `POST http://127.0.0.1:8300/v1/mimo/design` | `text`、`voice_description` |
| VoxCPM2 | `POST http://127.0.0.1:8300/v1/voxcpm2/design` | `text`、`voice_description` |

VoxCPM2 使用独立的 `/v1/voxcpm2/design` 路由，不与 Qwen 音色设计接口混用。后端由专用模块和 worker 将请求转换为官方格式 `(音色描述)正文`，不需要参考音频；`cfg_value` 与克隆请求一样统一读取后端顶部的 `VOXCPM2_CFG_VALUE`，官方 Demo 默认是 `2.0`，`inference_timesteps` 默认是 `10`。项目默认不固定随机种子；官方文档示例写死 `seed=42` 只是为了复现实验结果，并不表示该值具有特殊音质增益，需要对比或复现单次样本时才显式传入非负 `seed`。

角色音色分析会优先从结构化脚本中抽取该角色的代表台词和相邻旁白，再生成可复用的 `voice_description`。参考文案与音色生成是两个显式步骤：用户可以检查或编辑参考文案，再点击“生成音色”。生成音色不会再次调用 LLM，只把确认的音色描述作为 `voice_description`、参考文案作为 `text` 提交给 Qwen、MiMo 或 VoxCPM2。

参考音频必须已获得说话人授权、清晰且仅含一位说话人；参考文案应与实际语音逐字一致，不能写入未朗读的舞台说明、音频标签或 SSML（语音合成标记语言）。生成的参考音频和文案保存在浏览器本地音色库，并作为后续克隆的对应材料。

## `8311` SoundEffect

后端 `8311` 提供 MOSS-SoundEffect v2.0 的 `POST /v1/generate`，请求结束后释放对应 worker 的模型与显存。WebUI 通过 `soundeffect-client.js` 调用该接口；LLM 深度分析会把原文明确的非语言事件写入台词内 `sfx_plan`，用户可逐项生成或使用“生成全部 SoundEffect 音效”顺序生成。每次请求发送 `prompt` 与 `seconds`，返回的 WAV 以计划的 `audioAssetKey` 保存到浏览器 IndexedDB，并用于实时试听、离线 WAV/MP4 混音以及完整工程导入导出。页面没有 SFX 素材库、文件导入或名称匹配回退路径。

```json
{
  "prompt": "近距离收音，木门被轻轻推开，铰链短促吱呀后停止",
  "seconds": 1.2
}
```

`prompt` 必须是可直接用于生成的非语言声音描述；`seconds` 由计划的 `duration_seconds` 提供，前端限制为大于 `0` 且不超过 `30` 秒。
