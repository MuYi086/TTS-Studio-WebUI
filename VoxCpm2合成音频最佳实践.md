# VoxCPM2 合成音频最佳实践

本文依据 `dsShare.html`、`qwen3_情感剧本生成.json` 中关于 VoxCPM2 的讨论，并严格对齐现有后端 `POST http://127.0.0.1:8306/v2/synthesize` 的请求契约整理。核心原则是：括号内是给 VoxCPM2 的自然语言表演指令，括号外才是角色真正要合成的正文。

## 1. 两层剧本表达

### 人类可读的广播剧格式

剧本改写结果可以这样组织。角色、参考音频和模式是本段的元数据；每条台词前的括号是 Control Instruction（控制指令），括号外才是实际朗读文本：

```text
[角色: 林晓] [参考音频: linxiao_neutral.wav] [默认模式: 可控克隆]

(声音极度颤抖，带着哭腔，语速极快，气息不稳) 不要杀我。
(急促地倒吸一口凉气，压低声音，几乎是在用气声说话) 求求你不要过来……
(突然崩溃，音量拔高，声嘶力竭地尖叫) 啊——！救命！

[角色: 凶手] [参考音频: killer_neutral.wav] [默认模式: 可控克隆]

(低沉、缓慢，带着戏谑的冷漠) 你跑不掉的。
(突然暴躁，咬牙切齿，语速极快) 给我闭嘴！
```

括号内容不应被当作角色对白朗读；它描述的是情绪、音色质感、语速、音量、气息、停顿和发声动作。每条台词尽量只描述一个稳定表演节拍，情绪发生明显变化时再断句。

### 当前 WebUI 的 JSON 格式

当前时间轴不能把整段带括号的字符串直接当作 `text_content`。上面的第一句应拆成：

```json
{
  "type": "dialogue",
  "role_name": "林晓",
  "text_content": "不要杀我。",
  "control_instruction": "声音极度颤抖，带着哭腔，语速极快，气息不稳",
  "emotion": "fear",
  "intensity": "强烈",
  "clone_mode": "controllable",
  "delivery_profile": "fear",
  "voxcpm_nonverbal_tags": [],
  "needs_review": true,
  "break_duration": 0
}
```

`control_instruction` 保存括号内的自然语言，不要在字段值外再包一层括号；`text_content` 只保存括号外的真实正文。当前 WebUI 合成时将它们映射到固定的 `/v2/synthesize` 请求：可控克隆发送 `text`、`audio_path`、`backend: "voxcpm2"`、`clone_mode: "controllable"`、`control_instruction` 和 `nonverbal_tags`，明确省略 `prompt_text`；后端再组装为 `(control_instruction)[tag]正文`。为了兼容模型偶尔直接输出人类格式，页面也会识别 `text_content` 开头的单个英文或中文括号，并把它拆到 `control_instruction`。

角色参考音频由当前 WebUI 的角色绑定管理，不需要在每个 `dialogue` 中重复输出 `ref_audio`。`[参考音频: ...]` 可以保留在人类剧本或导演工作稿中，但不要让它进入 `text_content`。

## 2. 可控克隆与极致克隆

两种模式不是简单的质量高低，而是表演控制来源不同：

| 模式 | 参考音频作用 | 表演控制来源 | 适用情况 |
| --- | --- | --- | --- |
| `controllable`（可控克隆） | 主要提供角色音色 | `control_instruction`、正文、非语言标签 | 需要恐惧、哭腔、颤抖、耳语倾向、急促、压抑或爆发 |
| `ultimate`（极致克隆） | 提供音色以及参考片段的表达方式 | 参考音频本身和准确的 `prompt_text` | 稳定基线演绎，或需要贴近角色绑定参考片段 |

可控克隆的关键形式是：

```text
(自然语言表演指令)真实合成文本
```

极致克隆不应依赖括号内的情绪指令。当前 WebUI 在极致克隆时发送角色绑定音频的准确参考文案；可控克隆时发送 `control_instruction`，不发送 `prompt_text`。两条路径互斥。

固定请求示例：

```json
{
  "text": "不要杀我。",
  "audio_path": "linxiao_neutral.wav",
  "backend": "voxcpm2",
  "clone_mode": "controllable",
  "control_instruction": "声音极度颤抖，带着哭腔，语速极快，气息不稳",
  "nonverbal_tags": []
}
```

极致克隆则将 `clone_mode` 改为 `ultimate`，删除 `control_instruction`，改传准确的 `prompt_text`。`delivery_profile`、`emotion`、`intensity` 和 `needs_review` 是 WebUI 工程字段，不是该接口的替代请求字段。

## 3. 台词路由规则

对 LLM 改写后的每个 `dialogue`，按以下顺序判断：

1. 需要改变角色默认念法时，使用 `controllable`，并填写具体的 `control_instruction`。例如声音发抖、气息不稳、压低声音、哭腔、咬牙、突然急促或声嘶力竭。
2. 不需要特殊表演，且角色参考音频有准确逐字参考文案时，使用 `ultimate` + `baseline`，不填写控制指令。
3. 有自然语言控制指令时，`delivery_profile` 仍要选择一个最接近的档位，作为界面标记、路由兜底和人工筛选依据；精细表演以 `control_instruction` 为准。
4. 恐惧、紧张和悬疑不是非语言标签，也不自动等于耳语或喊叫。只有明确需要时，才把这些内容写进控制指令。
5. 当前 WebUI 只有角色级参考音频，不支持逐句替换情绪参考音频；不要虚构逐句 `ref_audio` 或 `ref_transcript`。

恐怖有声剧通常应以可控克隆为主。`ultimate` 适合作为旁白或普通对白的稳定基线，不适合拿中性参考音频去期待它自动生成“极度恐惧”。

## 4. 自然语言控制指令怎么写

一条指令应优先包含以下维度中的 2–5 项，避免堆叠互相冲突的形容词：

- 情绪：恐惧、惊慌、绝望、冷漠、威胁、强忍；
- 声音质感：颤抖、沙哑、哭腔、气声、咬牙、声音发紧；
- 节奏：缓慢、断断续续、语速极快、突然加速、关键字停顿；
- 气息：屏息、急促喘息、倒吸一口凉气、气息不稳；
- 音量和动作：压低声音、逐渐拔高、近乎尖叫、低声哀求。

推荐写法：

```text
(声音极度颤抖，带着哭腔，语速极快，气息不稳)
(急促地倒吸一口凉气，压低声音，断断续续地说)
(低沉缓慢，带着戏谑的冷漠，每个字都像在威胁)
(突然崩溃，音量拔高，声嘶力竭地尖叫)
```

不推荐写法：

```text
(恐惧) 不要杀我
(使用最真实、最有感染力、最电影化的方式表达极度复杂的恐惧)
```

前者信息太少，后者包含互相难以验证的抽象要求。控制指令应服务于这一条台词，而不是写成整段导演阐述。

## 5. 断句与正文边界

VoxCPM2 长文本不适合承载多个情绪转折。应按“一个可表演节拍”拆分：

- 在自然语义停顿、动作变化、说话人变化和情绪转折处断句；
- 同一角色连续且同一表演目标的短句可以保持同一个控制指令；
- 从耳语倾向转为急促求救、从克制转为崩溃时，拆成两句分别生成再拼接；
- 旁白以 25–45 个汉字作为软目标，过长内容在句号、分号或自然换气处拆分；
- 不要把每个两三个字的碎片都单独生成，除非它确实代表独立的呼吸、惊叫或停顿；
- `text_content` 只能包含角色真正要说的正文，不得包含 `(声音颤抖)`、角色头标、参考音频路径、`[fear]`、`[BREATH]`、舞台说明或 SSML（语音合成标记语言）；
- 省略号、重复和破折号只在正文确实需要表达犹豫、断裂或换气时使用，不能用来替代控制指令。

例如：

```json
[
  {
    "type": "dialogue",
    "role_name": "林晓",
    "text_content": "不要杀我。",
    "control_instruction": "声音极度颤抖，带着哭腔，语速极快，气息不稳",
    "clone_mode": "controllable",
    "delivery_profile": "fear",
    "voxcpm_nonverbal_tags": [],
    "needs_review": true,
    "break_duration": 0.1
  },
  {
    "type": "dialogue",
    "role_name": "林晓",
    "text_content": "求求你不要过来……",
    "control_instruction": "急促地倒吸一口凉气，压低声音，几乎用气声说话",
    "clone_mode": "controllable",
    "delivery_profile": "fear",
    "voxcpm_nonverbal_tags": [],
    "needs_review": true,
    "break_duration": 0.2
  }
]
```

## 6. 非语言标签

自然语言控制指令描述“怎么说”，官方非语言标签描述“明确出现了什么可听见的反应”。当前 WebUI 白名单为：

```text
laughing, sigh, Uhm, Shh,
Question-ah, Question-ei, Question-en, Question-oh,
Surprise-wa, Surprise-yo, Dissatisfaction-hnn
```

只有原文明确出现笑声、叹气、犹豫音、嘘声或对应问句/惊讶音时才使用标签；每句最多一个。标签只写入 `voxcpm_nonverbal_tags`，不能写入 `control_instruction`、`text_content` 或 `prompt_text`。出现标签时强制使用 `controllable` + `expressive`，并设置 `needs_review: true`。

“恐惧”“声音发抖”“哭腔”“呼吸不稳”不是非语言标签，应写入 `control_instruction`。

## 7. 参考音频与参考文案

### 可控克隆

- 每个角色准备清晰、单人、无音乐和明显环境噪声的中性参考音频；
- 参考音频主要作为音色锚点，情绪交给括号内自然语言指令、正文断句和后期音效；
- 参考音频本身带有强烈笑声、哭腔或情绪时，可能把原表达带入输出，应该先用中性片段建立基线。

### 极致克隆

- `prompt_text` 必须与参考音频实际朗读内容逐字一致；
- 不得在 `prompt_text` 中加入未朗读的角色头标、括号指令、舞台说明、音效标签或 SSML；
- 参考文案缺失或不准确时，不要强行使用 `ultimate`；改用可控克隆并试听；
- 参考音频必须获得说话人授权。

## 8. 当前工程字段与合成流程

脚本分析 Prompt 必须输出严格 JSON 数组。每个 `dialogue` 至少包含：

```json
{
  "type": "dialogue",
  "role_name": "角色名",
  "text_content": "括号外的实际朗读正文",
  "control_instruction": "括号内的自然语言指令；ultimate 时为空字符串或省略",
  "emotion": "系统允许的情绪键",
  "intensity": "微弱|稍弱|中等|较强|强烈",
  "clone_mode": "ultimate|controllable",
  "delivery_profile": "baseline|expressive|suspense|fear|urgent|restrained",
  "voxcpm_nonverbal_tags": [],
  "needs_review": false,
  "break_duration": 0
}
```

生成流程为：

1. LLM 将故事改写成角色、场景、台词和控制指令；
2. WebUI 将 `control_instruction` 与 `text_content` 分开保存；
3. `controllable` 请求发送固定接口需要的 `text`、`audio_path`、`backend="voxcpm2"`、`clone_mode="controllable"`、`control_instruction` 和必要的 `nonverbal_tags`，明确不发送 `prompt_text`；
4. VoxCPM2 后端组装 `(控制指令)[标签]正文` 后生成音频；
5. `ultimate` 请求发送准确的 `prompt_text`，不发送控制指令；
6. 对恐惧高潮、尖叫、哭腔和标签台词人工试听，多生成候选后再做拼接、SFX（音效）、BGM（背景音乐）、混响和响度处理。

4070 Ti SUPER 16GB 是否足够，应以实际 worker 的模型精度、上下文长度、并发数和 CUDA（GPU 加速平台）占用实测为准。稳妥做法是单请求、低并发、逐句生成，先确认显存峰值和长文本稳定性。

## 9. 常见误区

- 把 `(声音颤抖) 不要杀我` 整体存进 `text_content`，导致控制语句也被朗读；
- 只写 `emotion: "fear"`，却不提供自然语言 `control_instruction`；
- 用 `ultimate` 期待中性参考音频自动变成极度恐惧；
- 把角色头标、参考音频路径或 `[fear]` 标签写进正文；
- 把“恐惧”“哭腔”“声音发抖”误填成 `sigh`、`Uhm` 等非语言标签；
- 一句话同时要求耳语、尖叫、哭腔和快速叙述，应该拆成多个表演节拍；
- 把模型速度、显存余量或某个情绪指令的效果当成必然保证。

最终判断标准是试听：同一角色、同一中性参考音频下，`(控制指令)正文` 与中性基线是否形成清晰可辨的表演差异。
