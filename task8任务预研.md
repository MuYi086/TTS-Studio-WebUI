# Task 8：VoxCPM2 接入优化预研

## 结论

任务可落地，建议采用“前端 TTS（文本转语音）统一收敛到 VoxCPM2、保持正文与字幕纯净、用独立字段承载非语言标签”的实现路线。

现有实现已经完成约六成关键工作，尤其是 `clone_mode` 的两条主链路已基本符合官方定义。因此后续应在当前架构上补齐能力，不能重写或反转既有可控克隆逻辑。

## 已确认的版本边界

### 本版本实施范围

1. 前端的唯一合成与克隆 TTS 模型为 VoxCPM2。
2. `index.html` 中隐藏 IndexTTS2 的配置入口、说明、可选协议与合成调用；历史 IndexTTS2 配置不能再触发 `/v2/synthesize`。
3. 同时停止前端的 Qwen3-TTS Base 克隆调用。Qwen 与 MiMo 只保留“音色设计”用途，不再作为台词合成模型。
4. 三段自定义 Prompt 全面以 VoxCPM2 的 `ultimate`、`controllable`、短控制指令和非语言标签为中心设计。
5. Qwen / MiMo 的音色设计端点、队列、参考文案生成和音色库逻辑保持不变。
6. 按 D、E 节直接调整 VoxCPM2 后端的生成参数、参数透传与可控克隆标签链路。

### 本版本明确不实施

1. 不修改 IndexTTS2 的后端服务、接口、worker、测试、请求契约或启动逻辑；其现有能力继续保留。
2. 不修改 Qwen / MiMo 音色设计的后端接口、模型选择、请求参数或生成逻辑。
3. 后端改动严格限于 VoxCPM2 的 API、worker、helpers、VoxCPM2 专属 `start.sh` 参数、测试和文档，不改变其他模型的行为。

> `8300` 上的 `POST /v1/qwen/design` 与 `POST /v1/mimo/design` 是音色设计接口，并非 IndexTTS2 台词合成入口。本版本必须保留前两者，但停止前端对 `8300/v2/synthesize` 的调用；这不改变 IndexTTS2 后端本身。

## 官方文档结论

依据 [VoxCPM 2 使用指南](https://voxcpm.readthedocs.io/zh-cn/latest/usage_guide.html) 与 [VoxCPM 2 最佳实践](https://voxcpm.readthedocs.io/zh-cn/latest/cookbook.html)：

| 主题 | 官方建议 | 对本项目的含义 |
| --- | --- | --- |
| 可控克隆 | `reference_wav_path` 提供音色；在目标文本前加入括号内的控制指令（Control Instruction，控制指令）；不需要参考转写。 | `controllable` 必须只走参考音频 + 短控制指令，不能混入 `prompt_text`。 |
| 高保真克隆 | 同时提供 `reference_wav_path`、`prompt_wav_path` 与逐字准确的 `prompt_text`。 | `ultimate` 应继续使用当前的参考转写路径。 |
| 两种模式关系 | 高保真克隆下控制指令会被忽略。 | 两条路径必须互斥，不能将控制指令叠加到 `ultimate`。 |
| 非语言标签 | 直接写入目标文本；优先少量使用英文方括号标签，如 `[laughing]`、`[sigh]`、`[Uhm]`、`[Shh]`、`[Question-ah]`、`[Surprise-wa]`。 | 标签应以受限结构化字段保存，并只在 VoxCPM2 合成阶段拼接进模型输入。 |
| 生成参数 | `cfg_value` 常用范围为 `1.0–3.0`，默认 `2.0`；`inference_timesteps` 建议 `4–30`，默认 `10`。还支持 `normalize`、`denoise`、`retry_badcase`。 | 当前后端需要补齐后三个参数的透传与可调试默认值。 |
| 参考音频 | 干净、单人、稳定的参考音频最有利于克隆；实用时长为 `5–30` 秒。 | 继续保持当前生成参考文本的单人、自然、稳定策略，并将试听作为最终判定。 |

## 当前实现盘点

### 已具备且应保留的能力

1. `index.html` 已提供“剧本拆分与分析 Prompt”“角色音色分析 Prompt”“Qwen / MiMo 音色参考文本策略”三段独立可配置模板，并通过既有 `localStorage` 键保存。
2. 角色音色分析 Prompt 已明确要求输出跨场景稳定复用的 `voice_description`，而不是将一时的剧情情绪固化成音色。这符合音色设计的职责。
3. 动态参考文本已被约束为 `26–32` 个字符、单人、自然朗读、约 `7–10` 秒，且拒绝标签、SSML（语音合成标记语言）与舞台说明。该策略适合生成稳定的 Qwen / MiMo 参考音色，应保持。
4. WebUI 请求 VoxCPM2 时，`ultimate` 会提交 `prompt_text`；`controllable` 只提交 `control_instruction`，不提交 `prompt_text`。
5. `api/voxcpm2_api.py` 会在 `controllable` 下屏蔽上传 sidecar（伴随文件）中的参考转写；`api/voxcpm2_helpers.py` 会将控制指令写在目标文本前。这与官方调用方式一致。
6. `project-storage.js` 的 `normalizeDialogueLine()` 与导出逻辑会保留未知字段，因而可兼容性地扩展台词计划字段。
7. 现有 `TTS_PROTOCOLS` 同时包含 `indextts2`、`reference-text-clone` 与 `voxcpm2`，并会根据 `8300`、`8305`、`8306` 自动推断协议；这是本版本前端收敛的主要改动点。

### 需要补齐的缺口

1. 剧本分析 Prompt 目前没有输出非语言标签的专用字段。
2. LLM 输出映射、手工台词默认值和 VoxCPM2 请求构造尚未处理非语言标签。
3. `api/voxcpm2_api.py` 虽已配置 `cfg_value`、`inference_timesteps`、`load_denoiser`、随机种子、分段长度和拼接停顿，但 `normalize`、`denoise`、`retry_badcase` 尚未传到 `model.generate()`。
4. 后端的参数默认值同时存在于 `start.sh` 和 `api/voxcpm2_api.py`。`start.sh` 的 `${VAR:-默认值}` 会先设置环境变量，因此仅修改 Python 顶部的默认值不会生效，不符合“改脚本顶部即可调参”的目标。
5. `tests/test_synthesize_style_prompt_contract.py` 中 `test_voxcpm_worker_never_prepends_a_style_prompt` 的名称与当前、且正确的“控制指令前置到目标文本”行为不一致，应随实现更新为清晰的契约测试名称。
6. 现有前端仍可能从历史配置自动推断或选择 IndexTTS2、Qwen3-TTS Base。因此只隐藏下拉框选项不足以阻断调用，必须在保存、加载、配置选择和合成入口同时限制为 VoxCPM2。

## 推荐落地方案

### A. WebUI：剧本拆分与表演计划

为 `dialogue` 增加可选字段：

```json
{
  "voxcpm_nonverbal_tags": ["laughing"]
}
```

字段约束如下：

- 仅接受官方推荐的白名单值，例如 `laughing`、`sigh`、`Uhm`、`Shh`、`Question-ah`、`Question-ei`、`Question-en`、`Question-oh`、`Surprise-wa`、`Surprise-yo`、`Dissatisfaction-hnn`。
- 每条台词最多一个标签；没有效果时为空数组或省略字段。
- 仅在原文明确描述可被听见的笑、叹气、犹豫、嘘声、语气词或类似非语言发声时生成；不能仅因“悬疑”“悲伤”等氛围推断并滥加。
- 出现标签时，将 `needs_review` 设为 `true`，并收敛为 `clone_mode="controllable"`。

`defaultPromptTemplate` 应新增上述字段定义、白名单和决策规则，同时坚持以下边界：

- `text_content` 必须保持原文，不将 `[laughing]` 等标签写入正文。
- 说话人提示、动作描写仍保留为旁白，不得删除或改写。
- 非语言标签是 VoxCPM2 的模型输入信息，不是字幕、SRT、原文或 Qwen / MiMo 的输入内容。
- 删除“生成结果将直接用于 IndexTTS”“必须从情绪预设中选择以驱动 TTS”等 IndexTTS2 专属叙述。
- `emotion` 与 `intensity` 为保障历史工程、现有时间轴 UI 与导出数据兼容而保留；它们不再决定 VoxCPM2 的合成参数。逐句合成只以 `clone_mode`、`delivery_profile`、`needs_review` 和 `voxcpm_nonverbal_tags` 为准。

实现时需同步修改：

1. LLM JSON 结果到 `scriptLines` 的映射，读取、归一化并保存该字段。
2. 手工拆分和新增台词的安全默认值。
3. `getNormalizedVoxCpmPlan()`：带有效标签的台词应进入 `controllable`，并自动标记试听。
4. VoxCPM2 合成请求构造：仅该协议在发请求前把标签转换为 `[tag]` 拼到模型目标文本；后端 worker 在每个文本分段调用 `model.generate()` 前，必须向启动服务的终端打印该次**最终模型文本**（已包含 `(control_instruction)` 与 `[tag]`，例如 `(短促有力，节奏略快)[sigh]别再靠近了。`）。日志应同时标记分段序号和 `clone_mode`，但不打印参考转写或其他无关请求内容，便于逐条核对标签是否真的进入模型。
5. 项目导入、导出和历史工程恢复：无该字段时回退为空数组，旧工程行为不改变。
6. 前端提示文字及 `docs/TTS-and-VoiceDesign接入.md` 的字段契约。

### B. WebUI：TTS 配置与调用统一为 VoxCPM2

本版本应在前端同时完成“隐藏入口”和“阻断调用”，两者缺一不可。

| 区域 | 本版本动作 | 兼容与边界 |
| --- | --- | --- |
| TTS 配置表单 | 仅展示 `VoxCPM2（极致 / 可控克隆）`；新建配置固定为 `voxcpm2`。 | 不删除已保存的旧配置，避免破坏 `localStorage`。 |
| 历史配置加载 | 旧 `indextts2`、`reference-text-clone` 配置在列表中标为“已停用”，不可选作台词合成服务。 | 可保留数据供未来人工迁移或回退，不自动改写原记录。 |
| 当前配置选择 | 没有有效 VoxCPM2 配置时，阻止台词合成并提示用户选择或新增 VoxCPM2 服务。 | 不将 `8300` 或 `8305` 静默改写为 `8306`，避免误指向服务。 |
| 协议推断 | 前端台词合成不再根据 `8300` 推断 `indextts2`，也不根据 `8305` 推断 `reference-text-clone`。 | `8300` 继续可用于 Qwen / MiMo 音色设计，不影响该链路。 |
| 合成请求 | `synthesizeLine` 与批量合成仅允许 `usesVoxCpm2(config) === true` 执行。 | 禁止向 `8300/v2/synthesize`、`8305/v2/synthesize` 发起台词合成请求。 |
| 页面文案 | 移除或替换 IndexTTS2、Qwen3-TTS 克隆的协议说明，统一说明 VoxCPM2 的极致/可控克隆。 | Qwen / MiMo 的“音色设计”名称和入口保持不变。 |

### C. WebUI：角色音色分析 Prompt

现有 Prompt 的主方向正确，应以增强约束为主，而不是扩大输出长度或将当前剧情情绪写入 `voice_description`。

建议补充：

- 描述稳定的身份、年龄段、音域、质感、咬字、默认节奏和气质；临时的害怕、发抖、笑声、耳语等必须留给逐句表演计划。
- 只有原文明确时才写方言或口音；若需要方言，正文应使用地道方言表达，不能以普通话硬套。
- 禁止输出方括号非语言标签、舞台说明、混响、EQ、压缩等后期处理词。
- 保持两句、`60–120` 汉字的现有限制，避免长 Prompt 使 Qwen / MiMo 音色描述互相矛盾。

#### Qwen / MiMo 音色参考文本策略

本项不是首要改动。当前策略已满足“单人、自然、稳定、易读、无标签”的要求，且生成后允许用户手工确认和编辑，建议保留。

可做的轻量优化：

- 在模板中进一步强调“默认状态，不复制某一场剧情表演”。
- 明确 Qwen / MiMo 参考文本不承载 VoxCPM2 的控制指令或非语言标签。
- 保持 `26–32` 字及一至两个自然短句的程序校验；如实测某个模型最佳时长不同，再基于实测数据调整范围，不预设为通用最优值。
- 本版本不改动 Qwen / MiMo 音色设计接口、模型选择、请求参数或生成队列。

### D. 后端：集中且可直接修改的生成参数

本节属于本版本后端改动范围。在 `TTS-and-VoiceDesign/api/voxcpm2_api.py` 顶部增加带中文注释的“VoxCPM2 生成参数调试区”，作为无环境变量覆盖时的唯一默认来源。调试区内的每个公共变量都必须在定义处说明“影响什么、何时调整、过高或过低的代价”，不允许只保留无说明的赋值：

```python
# 用于人工试听和调参的默认生成参数；环境变量存在时仍可覆盖。
# CFG 引导强度：越高越严格贴近输入与控制，但难例更容易出现噪声；长文发糊时优先降低到 1.5–1.6。
VOXCPM2_CFG_VALUE = 2.0
# 扩散推理步数：越高通常细节更好但生成更慢；10 为官方均衡起点，建议在 4–30 内逐组试听。
VOXCPM2_INFERENCE_TIMESTEPS = 10
# 是否文本规范化：用于展开数字和日期等原始文本；启用可能改变字面读法，不用于已手工控制的音素输入。
VOXCPM2_NORMALIZE = False
# 是否先给参考/提示音频降噪：只在参考音频噪声明显时启用；可能轻微改变原始声线。
VOXCPM2_DENOISE = False
# 是否自动重试明显过短或过长的异常生成：提高成功率，但异常样本会增加等待时间。
VOXCPM2_RETRY_BADCASE = True
# 是否加载降噪器：仅在 VOXCPM2_DENOISE 为 True 时必须为 True；关闭可减少不需要降噪时的负担。
VOXCPM2_LOAD_DENOISER = False
# 是否启用模型可选优化：可能改善速度或显存占用，但不同 VoxCPM2 版本的收益和兼容性不同；默认关闭，确认环境稳定后再对比。
VOXCPM2_OPTIMIZE = False
# 推理设备：VoxCPM2 当前服务要求 CUDA GPU；通常保持 cuda，只有排障时才改为明确的 cuda:序号。
VOXCPM2_DEVICE = "cuda"
# 随机种子：固定值便于横向比较参数；设为负数时允许每次随机生成，用于观察模型波动。
VOXCPM2_SEED = 20260614
# 单次合成的最大字符数：0 表示不切分；正数按标点切段可提升长文稳定性，但会引入段间衔接差异。
VOXCPM2_MAX_CHARS_PER_CHUNK = 0
# 分段拼接时插入的静音毫秒数：只在文本被切为多段时生效；过大会让语速显得拖沓。
VOXCPM2_PAUSE_MS = 250
# 单个 worker 的最长等待秒数：只用于防止模型卡死，不改变音质；过短会中断慢速长文，过长会延迟失败反馈。
VOXCPM2_REQUEST_TIMEOUT = 600
```

处理原则：

- 初始值保留官方的均衡基线 `cfg=2.0`、`timesteps=10`，不能在没有实机对比前声称某组为最优。
- 对长文本出现发糊、嗡声等问题，可从 `cfg=1.5–1.6` 开始试听；步数提高会增加耗时，应独立记录效果和耗时。
- 删除 `start.sh` 对上述调试参数的硬编码默认注入，避免覆盖 Python 顶部赋值；显式设置的环境变量仍可作为部署覆盖手段。
- `normalize`、`denoise`、`retry_badcase` 要贯通“请求模型 → worker payload → `build_helper_args()` → `generate_kwargs()`”。
- `denoise=True` 时必须同时加载降噪器：应自动令 `load_denoiser=True`，或在 API 层给出明确配置错误，避免 worker 运行后才失败。
- 保留现有签名检查和过滤逻辑，以兼容已安装的不同 VoxCPM2 版本。
- 本版本直接实施上述 VoxCPM2 改动；IndexTTS2、Qwen3-TTS Base 和 Qwen / MiMo 音色设计相关后端文件不在改动范围内。

### E. 后端：可控克隆的最终契约

`controllable` 应继续遵守以下契约：

| 项目 | 要求 |
| --- | --- |
| `reference_wav_path` | 必传，用于提取原始音色。 |
| `prompt_text` / `prompt_wav_path` | 不传，也不从 sidecar 回退。 |
| `control_instruction` | 必传，使用短、明确、无相互矛盾内容的控制指令。现有固定档位词表继续保留。 |
| 非语言标签 | 只接受后端 Pydantic（数据校验模型）白名单字段；最终写为 `[tag]`。 |
| 最终模型文本 | `(短控制指令)[tag]原台词`；无标签时为 `(短控制指令)原台词`。 |
| 人工试听 | 有标签、耳语、尖叫、哭喊等极端表演必须标记 `needs_review=true`。 |

不建议在 WebUI 增加可任意填写的 `control_instruction` 输入框。过长、相互矛盾或不稳定的提示会降低音色复刻稳定性；固定档位词表更适合当前批量有声书工作流。

## 不应采用的做法

1. 不将 `[laughing]` 等标签直接保存到 `text` / `text_content` 或 `prompt_text`；这会污染原文、字幕、导出，以及非 VoxCPM2 模型的合成输入。
2. 不因每一句是惊悚、悲伤或非平静情绪就切换 `controllable`；当前“只有明确表演变化才切换”的原则应保留。
3. 不将临时表演、非语言标签或后期效果写入 Qwen / MiMo 的音色描述与参考文本。
4. 不将参考音频 `5–30` 秒作为上传硬拒绝条件；它是实用建议，格式与存量兼容更重要。应通过 UI 提示、生成后试听和调参记录来引导。

## 验证计划

### 本版本：前端收敛与 VoxCPM2 后端验证

前端修改后运行：

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)){if(match[1].trim())new Function(match[1]);}"
node scripts/validate-p1-regression-fixture.mjs
```

并重点验证：

- 新建和编辑 TTS 配置时仅能选择 VoxCPM2。
- 选择或恢复历史 `indextts2` / `reference-text-clone` 配置时，台词单条与批量合成都会被阻断，且不会请求 `8300/v2/synthesize` 或 `8305/v2/synthesize`。
- Qwen / MiMo 音色设计仍可请求其原有 `/v1/qwen/design`、`/v1/mimo/design` 端点。
- `ultimate` 仍传准确 `prompt_text`；`controllable` 仍只传控制指令和参考音频。
- 合法 `voxcpm_nonverbal_tags` 只进入 VoxCPM2 目标文本，不进入原文、字幕、SRT 或参考转写。
- 无标签、无新字段的旧工程仍按当前基线合成与导出。

### 本版本：VoxCPM2 参数链路验证

新增以下 VoxCPM2 单测并执行完整测试：

```bash
conda run -n unitale-tts-local python -m unittest discover -s tests
```

- `controllable` + 合法标签：传参考音频和控制指令，不传参考转写；mock（模拟）worker 输出须包含拼接后的最终模型文本、分段序号与 `clone_mode`。
- `controllable` + 非法/多个标签：请求被校验拒绝或归一化为安全值。
- 无标签的旧工程：请求与当前版本完全一致。
- `ultimate`：仍传准确 `prompt_text`，不传控制指令或标签。
- `normalize`、`denoise`、`retry_badcase`：均可到达 `model.generate()`。
- `denoise=True` 与 `load_denoiser` 的联动。
- 参数配置来源：未设环境变量时 Python 顶部赋值生效；设环境变量时覆盖生效。

### 实机试听矩阵

使用同一段已授权、干净、单人、时长 `5–30` 秒的参考音频，固定目标文本比较：

| 目的 | 建议起点 | 观察项 |
| --- | --- | --- |
| 官方均衡基线 | `cfg=2.0`、`steps=10` | 音色相似度、自然度、耗时。 |
| 长文稳定性 | `cfg=1.5–1.6`、`steps=10–12` | 发糊、嗡声、尾部失控、耗时。 |
| 细节试听 | `cfg=2.0`、`steps=12–16` | 细节提升是否值得增加的耗时。 |
| 参考音频降噪 | 仅噪声明显时 `denoise=True` | 噪声改善与声线变化的取舍。 |
| 非语言效果 | `[laughing]`、`[sigh]`、`[Uhm]` 各一例 | 是否真实生效、是否破坏音色、是否需要剪辑。 |

每组应记录参数、参考音频、目标文本、生成时长、主观试听结果与输出文件名，最后再确定项目默认值。

## 预计改动范围

### 本版本：前端与 VoxCPM2 后端

- `TTS-Studio-WebUI/index.html`
- `TTS-Studio-WebUI/project-storage.js`
- `TTS-Studio-WebUI/README.md`
- `TTS-Studio-WebUI/docs/TTS-and-VoiceDesign接入.md`
- `TTS-and-VoiceDesign/api/voxcpm2_api.py`
- `TTS-and-VoiceDesign/api/voxcpm2_worker.py`
- `TTS-and-VoiceDesign/api/voxcpm2_helpers.py`
- `TTS-and-VoiceDesign/start.sh`
- `TTS-and-VoiceDesign/tests/test_voxcpm2_bundled_helpers.py`
- `TTS-and-VoiceDesign/tests/test_synthesize_style_prompt_contract.py`
- `TTS-and-VoiceDesign/README.md`

### 明确不改动的后端范围

- `TTS-and-VoiceDesign/api.py` 与 IndexTTS2 相关 worker、测试及请求契约。
- Qwen3-TTS Base 的合成后端。
- Qwen / MiMo 音色设计后端及其请求逻辑。

## 当前工作区状态

- 前端仓库：仅有用户新建、未跟踪的 `task8.md`。
- 后端仓库：工作树干净。
- 本预研只写入本文档，未修改任何功能代码或现有文档。
