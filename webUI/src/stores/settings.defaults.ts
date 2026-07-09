export interface LlmConfigItem {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  key: string;
  params: string;
}

export interface TtsConfigItem {
  id: string;
  name: string;
  baseUrl: string;
}

export const STORAGE_KEYS = {
  activeTab: 'storyforge_activeTab',
  llmConfigs: 'storyforge_configs',
  legacySingleLlm: 'storyforge_universal_v2',
  currentLlmConfigId: 'unitale_llmConfigId',
  ttsConfigs: 'storyforge_tts_configs',
  currentTtsConfigId: 'unitale_ttsConfigId',
  promptTemplate: 'storyforge_prompt_template',
  useCustomPrompt: 'storyforge_use_custom_prompt',
  voicePromptTemplate: 'storyforge_voice_prompt_template',
  useCustomVoicePrompt: 'storyforge_use_custom_voice_prompt',
  qwenVoiceTextTemplate: 'storyforge_qwen_voice_text_template',
  useCustomQwenVoiceText: 'storyforge_use_custom_qwen_voice_text'
} as const;

export const DEFAULT_PROMPT_TEMPLATE = `你的任务是将给定小说内容拆分为台词和旁白，并自动识别每一句台词的角色和情绪。
**注意：生成的结果将直接用于 IndexTTS 语音合成系统，请严格从指定的情绪列表中选择，不要自行生成情绪描述文本。**

\${sfxSection}

\${bgmSection}

\${filterSection}

# 情绪与强度设置 (Emotion & Intensity)
请为每一句台词（包括旁白）选择一个最合适的情绪和强度。

1. **可选情绪 (Emotion)**: \${emotionList}
   - **注意**: 必须严格从上述列表中选择，**严禁**编造列表之外的情绪名称。
   - 旁白通常选择 "平静"，也可根据氛围选择其他情绪。

2. **可选强度 (Intensity)**: 微弱, 稍弱, 中等, 较强, 强烈
   - 请根据上下文判断情绪的强烈程度。
   - **旁白强度**: 如果旁白有情绪（如伤心、害怕），强度必须很弱（建议选择 "微弱" 或 "稍弱"）。如果旁白是 "平静" 情绪，强度应为 "中等"。

# 规则

## 1. 拆分与识别
- **完整保留**: 必须完整保留原文内容，不得遗漏、删改或省略任何字句。
- **严禁删改**: **绝对禁止**删除原文中的说话人提示语（如“他低声说”、“笑着问道”）。这些内容必须作为“旁白”单独提取出来。
- **内容提取**: 提取对话内容和所有非对话的旁白。
- **角色识别**: 根据小说内容分析说话人。旁白的角色名统一标记为“旁白”。
- **长度控制**: 文本拆分长度要适中。**避免过碎**（不要把每一句短句都拆成独立一行），也**避免过长**（单行文本建议不超过 50-80 字，过长的旁白请在句号处适当拆分）。
- **旁白处理**: 连续的旁白内容应优先合并，除非中间需要插入音效、有明显的时间跳跃，或合并后长度过长。

## 3. 音效插入 (sfx)
- 如果情节需要（如“摔门而去”、“雷声大作”），且音效库中有对应素材，请在 JSON 对象中添加 \`sfx\` 字段。
- **严格限制**: 只能使用【音效库】中列出的名称。如果库为空或没有匹配项，**绝对不要**添加此字段。
- **禁止混用**: **绝对禁止**在 \`sfx\` 字段中使用【背景音乐库】中的名称。SFX 只能使用【音效库】的内容。
- **支持多音效**: 一句台词中可以插入多个音效，只要位置合理（如开头关门，中间脚步声）。
- 格式: \`"sfx": [{"name": "音效名称", "position": 0.5}, {"name": "另一音效", "position": 0.9}]\`
- \`position\`: 0.0-1.0 之间的浮点数，表示音效在**台词念白时长内**的插入位置（例如 0.0 为开始，1.0 为念白结束）。
- **重要**: \`position\` 计算**不包含** \`break_duration\`（停顿时间）。即 1.0 代表台词说完的那一刻，而不是停顿结束的那一刻。
- **间隔音效**: 如果音效发生在台词后的停顿期间，请将其加入该台词的 \`sfx\` 列表，位置设为 1.0。
- **特别重要** 尽量给每句都配上合适的SFX音效，如果有的话

## 4. 背景音乐控制 (BGM Control)
- **开头BGM**: 请**务必**在脚本的最开始尝试匹配并插入一个适合当前氛围的 BGM。只要【背景音乐库】中有合适的，就**必须**插入。
- 当剧情氛围发生变化，需要切换或停止背景音乐时，请插入一个独立的 BGM 控制对象。
- **格式**: \`{"type": "bgm", "action": "play", "name": "BGM名称"}\` 或 \`{"type": "bgm", "action": "stop"}\`
- **严格限制**:
  - \`name\` 字段**必须完全等于**【背景音乐库】中列出的某一个名称。
  - **禁止混用**: **绝对禁止**在 BGM 控制块中使用【音效库】中的名称。BGM 只能使用【背景音乐库】的内容。
  - 如果【背景音乐库】为空，或者没有匹配的音乐，**绝对不要**生成 action="play" 的控制块。
  - 禁止使用 "MysteriousBGM", "SadPiano" 等示例中出现但库里没有的名称。
- **注意**: 不要将 bgm 字段放在台词对象中。
- 请多切换BGM，体现多样性

- **停顿时间**: 分析台词后的剧情节奏，设置该台词结束后的停顿时间（秒）。
- 默认为 0。如果有动作描写或心理活动暗示停顿，请设置相应时长（如 0.5, 1.0, 2.0）。
- 示例: 两人对话间的尴尬沉默，或动作描写（如“他喝了一口茶”）需要的时间。

## 5. 音频滤波器 (Filter)
- 如果剧情环境特殊（如“在水下说话”、“电话通话中”、“回忆/内心独白”），且【滤波器库】中有对应效果，请在台词对象中添加 \`filter\` 字段。
- **格式**: \`"filter": "滤波器名称"\`
- **严格限制**: 必须使用【滤波器库】中存在的名称。如果没有匹配项，**不要**生成此字段。
- **特别提醒**: 如果角色是“旁白”，**千万不要**使用滤波器功能。

## 6. 输出格式
- **严格 JSON**: 输出格式必须是严格的 JSON 数组，不包含任何额外说明或代码块标记。
- **数组元素**: 必须是以下两种对象之一：
  1. **台词对象**: \`{"type": "dialogue", "role_name": "...", "text_content": "...", "emotion": "...", "intensity": "...", "break_duration": 0, "filter": "...", "sfx": [...]}\`
  2. **BGM对象**: \`{"type": "bgm", "action": "play", "name": "..."}\` 或 \`{"type": "bgm", "action": "stop"}\`
  - **严禁生成** \`{"type": "sfx", ...}\` 这种独立音效块。音效必须包含在台词对象的 \`sfx\` 字段中。


## 7. 背景图片块 (bgImage)
- **插入时机**: 当场景氛围、地点、时间（白天/夜晚）、或叙事视角发生变化时，请在相邻的台词对象之间插入一个背景图片对象。
- **插入位置**: 背景图片对象必须出现在“某个台词对象之后”并且“紧接着下一个台词对象之前”（不要插到台词组的内部）。
- **对象格式**: \`{"type":"bgImage","image_prompt":"..."}\`
  - \`image_prompt\` 必须是用于生成图片的**中文提示词**，并且必须根据当前小说上下文生成（包含：场景/地点、人物外观与表情（如果画面中需要人物）、衣着风格、光线、画面构图、镜头感、氛围与情绪、画风偏好等）。
  - **提示词质量**: \`image_prompt\` 只输出中文、不要输出任何 JSON/代码/多余解释，尽量是一段可直接用于“生成图片”的提示文本（越具体越好，避免“可能/也许/看起来”之类不确定词）。
  - **人物一致性（严格统一）**: 如果 \`image_prompt\` 中出现人物（包括面部/身体/衣着等可识别外观），则必须对每个出现人物给出“统一人物外观设定”，并且同一人物在所有 \`bgImage\` 块中必须保持完全一致：性别、年龄（或年龄段）、服装款式/颜色/材质、发型（发色/发长）、标志性特征/配饰（如有）。为保证一致性，你必须把人物外观设定写成同一种中文短句模板，并且对同名人物要求“逐字不变”（不要同义改写）：
    - 模板示例：\`人物外观设定：{角色名}（性别=...，年龄=...，服装=...，发型=...，标志=...，主要配色=...）\`
  - 角色名判定规则：\`{角色名}\` 必须使用当前背景图片所处场景中最近一次出现的 \`dialogue\` 对象的 \`role_name\`（例如“老李”“我”“旁白”等），同一 \`role_name\` 即视为同一人物。
  - 除非当场景完全不出现该人物，否则不要省略其外观设定；否则可能导致不同图片出现“同一个人物外观不一致”。
  - 提示词只需要中文，不需要输出图片数据或链接。
- **字段限制**: \`bgImage\` 对象只输出上述必要字段（至少必须有 \`type\` 与 \`image_prompt\`）。
- **与第 6 点兼容**: 即使第 6 点列出了两种对象，本规则要求你额外输出 \`type":"bgImage"\` 的第三种对象；最终仍然是一个严格 JSON 数组。
- **type 字段严格性**: \`type\` 字段必须严格等于 \`bgImage\`（大小写不要改）。
- **数量约束（严格遵守）**: 请在整个 JSON 数组中严格插入且仅插入 \${bgImageCount} 个 \`type":"bgImage"\` 对象，并且它们必须全部与剧情相关（不能随便凑数）。
- **开场强制**: 第一个 \`bgImage\` 对象必须出现在“第一个 dialogue 对象之前”，用于视频开场背景；允许开头存在 \`bgm\` 控制块，但 \`bgImage\` 仍必须早于第一个 \`dialogue\`。
- **分布要求**: 除开场第一张外，其余 \`bgImage\` 必须按照剧情节奏插入在台词之间（至少间隔一个 \`dialogue\`），避免连续出现多个 \`bgImage\`。
- **例外开场**: 允许第一个 \`bgImage\` 作为开场背景，放在第一个 \`dialogue\` 之前；其余 \`bgImage\` 仍按“某个台词对象之后并紧接着下一个台词对象之前”的相邻插入规则执行。


## 小说原文:
<novel_content>
“别接那个电话！”老李猛地按住了我的手，脸色惨白，“那是昨晚值班的小张打来的。”
我愣住了，看着办公桌上疯狂震动的座机：“可是……小张不是今早已经确认死亡了吗？”
“对，”老李的声音在发抖，“所以，别接。如果你接了，他会问你为什么不救他。”
</novel_content>

## 输出:
[
\${bgmExampleLine}
  {"type": "dialogue", "role_name": "老李", "text_content": "别接那个电话！", "emotion": "害怕", "intensity": "强烈", "break_duration": 0},
  {"type": "dialogue", "role_name": "旁白", "text_content": "老李猛地按住了我的手，脸色惨白，", "emotion": "平静", "intensity": "中等", "break_duration": 0},
  {"type": "dialogue", "role_name": "老李", "text_content": "那是昨晚值班的小张打来的。", "emotion": "害怕", "intensity": "较强", "break_duration": 0.5},
  {"type": "dialogue", "role_name": "旁白", "text_content": "我愣住了，看着办公桌上疯狂震动的座机：", "emotion": "平静", "intensity": "中等", "break_duration": 0\${sfxExample}},
  {"type": "dialogue", "role_name": "我", "text_content": "可是……小张不是今早已经确认死亡了吗？", "emotion": "惊喜", "intensity": "微弱", "break_duration": 0.5},
  {"type": "dialogue", "role_name": "老李", "text_content": "对，", "emotion": "低落", "intensity": "中等", "break_duration": 0},
  {"type": "dialogue", "role_name": "旁白", "text_content": "老李的声音在发抖，", "emotion": "平静", "intensity": "中等", "break_duration": 0},
  {"type": "dialogue", "role_name": "老李", "text_content": "所以，别接。如果你接了，他会问你为什么不救他。", "emotion": "害怕", "intensity": "强烈", "break_duration": 0}
]

# 输入内容

## 小说原文:
<novel_content>
\${rawScript}
</novel_content>`;

export const DEFAULT_VOICE_PROMPT_TEMPLATE = `请根据以下小说片段，简要描述角色“\${charName}”的音色特征。
要求：必须要带上性别，对音色的描述文本非常精炼，控制在20字以内。重点描述声音的物理质感（如声线粗细、年龄感、沙哑/清脆等），不要包含过多的性格或情绪描写。直接输出描述，不要废话。

小说片段：
\${rawScript}`;

export const DEFAULT_QWEN_VOICE_TEXT_TEMPLATE =
  '我是${charName}，初次见面，请多多指教。正在进行声线校准测试，一，二，三。这段音频将作为我的基准音色，希望能完美演绎接下来的故事，请多关照。';
