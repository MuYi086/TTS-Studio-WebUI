# 重构 Vue 工程计划

## 1. 目标与硬约束

本计划的目标不是“把 `index.html` 换个写法”，而是把当前单文件原型重构为一个**可持续维护的 Vue 工程**，同时满足以下硬约束：

1. **1:1 复现原有功能**
   - 复现的是**行为与结果**，不是逐行照抄代码。
   - 用户可见能力、项目文件格式、导入导出结果、播放与导出时序、模型调用协议都必须保持一致。

2. **不做大爆炸式重写**
   - 重构必须按阶段推进，每一步都可运行、可验收、可回退。
   - 旧 `index.html` 在最终切换前一直保留，作为行为对照物（oracle）。

3. **先建立边界，再搬代码**
   - 先拆清楚领域模型、状态边界、Side Effect（副作用）边界，再写组件。
   - 禁止把“旧逻辑原封不动复制进一个新的大组件”。

4. **符合最佳实践与人类可维护性**
   - 默认栈：`Vue 3` + `Vite` + `TypeScript` + `Pinia` + `Vitest` + `Playwright`。
   - 单向数据流：`Props Down / Events Up`，跨特性共享状态交给 Store（状态仓库）或受控 Composable（组合式函数）。
   - 纯逻辑、I/O、UI 分层明确。

5. **本轮只做 P2**
   - 不顺手推进 P3 的 provider（模型提供商）统一抽象，不做 UI 改版，不加新功能。
   - 一切“体验优化”必须在 1:1 验收完成后再讨论。

## 2. 现状诊断

当前仓库的核心实现集中在以下文件：

- `index.html`：`5609` 行
- `project-storage.js`：`346` 行
- `voice-design.js`：`4` 行

当前 `index.html` 同时承担了以下职责：

1. 页面结构与交互
2. 所有响应式状态
3. `localStorage`（浏览器本地键值存储）读写
4. `IndexedDB`（浏览器本地数据库）读写
5. 资源文件缓存与恢复
6. LLM（大语言模型）请求
7. TTS（文本转语音）请求
8. 音色设计请求
9. 音频播放、混音、滤波、裁剪、波形绘制
10. 顺序播放编排
11. `WAV` / `SRT` / `MP4` 导出
12. 项目导入导出与 schema（结构版本）迁移

这导致了 5 类根本问题：

### 2.1 领域模型和运行时状态混在一起

例如台词行对象同时混有：

- 持久化字段：`role`、`text`、`emotion`
- 运行时字段：`audioUrl`、`isGenerating`、`abortController`

结果是：

- 持久化边界不清晰
- 恢复逻辑复杂
- 导入导出时容易遗漏或污染

### 2.2 UI、状态、I/O 强耦合

组件代码直接调用：

- `fetch`
- `indexedDB`
- `localStorage`
- `AudioContext`
- `alert` / `confirm`

结果是：

- 无法单测
- 无法局部替换实现
- 行为修改时牵一发动全身

### 2.3 共享状态没有明确所有者

当前 `characters`、`scriptLines`、`timbres`、`sfxLibrary`、`bgmLibrary`、`emotionPresets`、`filterLibrary`、`scriptList` 等跨区域共享，但没有 Store（状态仓库）边界，只有一个超大 `setup()`。

结果是：

- 改一个功能时，很难知道谁依赖谁
- 派生状态与真实状态经常缠绕
- 后续多人维护成本极高

### 2.4 副作用没有统一编排层

音频播放、批量生成、导出视频、恢复本地资源、上传音色文件等都是“流程型逻辑”，但现在散落在页面函数中。

结果是：

- 流程中断/取消/重试逻辑分散
- 很难建立统一错误处理
- 很难验证时序一致性

### 2.5 代码可读性已经越过临界点

当前文件规模已经超出人类对“单个上下文块”的舒适阅读范围。再继续往 `index.html` 堆功能，只会把未来的任何修改都变成高风险操作。

## 3. 第一性原理

本次重构必须遵守 6 条第一性原则：

### 3.1 先定义“真相”，再定义“界面”

真正稳定的系统，不是先有组件，而是先有：

- 数据结构
- 领域约束
- 状态转移规则
- 副作用边界

界面只是这些规则的投影。

### 3.2 纯逻辑必须先从 I/O 中剥离

凡是可以纯函数化的内容，都不应该留在组件里，例如：

- 项目 schema 规范化
- 角色/音色匹配
- LLM 返回 JSON 解析
- 时间轴计算
- 音频剪辑区间换算
- BGM / `bgImage` 预扫描

### 3.3 状态必须有唯一所有者

一个状态只能有一个明确的 owner（拥有者）：

- 项目级数据归 `projectStore`
- 资源库归 `libraryStore`
- 配置与 Prompt（提示词）归 `settingsStore`
- 播放与导出运行态归 `playbackStore` / `jobStore`

禁止“多个组件各自维护一份看起来差不多的数据”。

### 3.4 组件只负责组合，不负责系统编排

组件应当只负责：

- 展示
- 输入
- 发出意图

不应直接负责：

- 协议调用
- 文件存储
- 音频编排
- 导出渲染

### 3.5 重构必须以回归验收驱动

没有验收闭环的重构，不是工程，是赌博。

P1 已经建立了最小回归入口，P2 必须在此基础上扩展，而不是绕开。

### 3.6 1:1 复现优先于“顺手优化”

本阶段的成功标准不是“更优雅”，而是：

- 一样能用
- 一样稳定
- 一样导入导出
- 一样恢复项目
- 一样生成与导出结果

## 4. 重构完成后的目标形态

## 4.1 技术栈

- `Vue 3`
- `Vite`
- `TypeScript`
- `Pinia`
- `Vitest`
- `Playwright`
- 继续保留现有 `Tailwind`（若当前使用 CDN 版，则切到工程化配置）

## 4.2 明确不引入的东西

以下内容在 P2 阶段**不引入**：

- `Nuxt`
- 服务端渲染（SSR）
- Vue Router（路由）强制改造
- 新 UI 框架
- Provider 协议改造
- 云端后端中转

说明：

- 当前产品是**单页工作台**，不是内容站。
- 先把状态、逻辑、导出、存储边界拆清楚，比先引入路由更重要。
- 如果后续需要深链接，可以在 P2 收尾后再评估 Router。

## 4.3 目标目录结构

```text
src/
  app/
    App.vue
    main.ts
    providers/
    styles/

  domain/
    project/
      types.ts
      schema.ts
      normalize.ts
      stripRuntime.ts
      factories.ts
    script/
      types.ts
      lineMatching.ts
      timeline.ts
    audio/
      filters.ts
      trim.ts
      waveform.ts
    prompts/
      templates.ts
      builders.ts

  stores/
    settings.store.ts
    library.store.ts
    project.store.ts
    playback.store.ts
    jobs.store.ts

  services/
    storage/
      projectRepository.ts
      assetRepository.ts
      preferenceRepository.ts
    providers/
      llmClient.ts
      ttsClient.ts
      voiceDesignClient.ts
    media/
      playbackEngine.ts
      audioExportService.ts
      videoExportService.ts
      previewService.ts
    import-export/
      projectImportService.ts
      projectExportService.ts
      subtitleExportService.ts

  composables/
    useActiveScript.ts
    usePreviewPlayback.ts
    useWaveformTrim.ts
    useProjectAutoSave.ts
    usePromptSettings.ts

  components/
    app/
      AppShell.vue
      TopTabs.vue
      GlobalToolbar.vue
    config/
      LlmConfigPanel.vue
      TtsConfigPanel.vue
    timbres/
      TimbreForm.vue
      TimbreList.vue
      EmotionPresetPanel.vue
    libraries/
      SfxLibraryPanel.vue
      BgmLibraryPanel.vue
      FilterLibraryPanel.vue
    script/
      ScriptWorkbenchPage.vue
      ScriptTabsBar.vue
      CharacterPanel.vue
      RawScriptPanel.vue
      AnalyzeActionsPanel.vue
      ScriptTimeline.vue
      DialogueLineCard.vue
      BgmBlockCard.vue
      BgImageBlockCard.vue
      LineWaveform.vue
      LineSfxEditor.vue
    prompt/
      PromptSettingsPage.vue
      PromptTemplateEditor.vue

  utils/
    ids.ts
    blob.ts
    browser.ts
    assertions.ts
    error.ts

tests/
  unit/
  component/
  e2e/
```

## 4.4 组件边界图

### 应用壳层

- `AppShell.vue`
  - 只负责页面骨架、顶层布局、切换页签
- `TopTabs.vue`
  - 只负责页签导航
- `GlobalToolbar.vue`
  - 只负责导入导出入口，不处理底层逻辑

### 配置域

- `LlmConfigPanel.vue`
- `TtsConfigPanel.vue`

### 资源库域

- `TimbreForm.vue`
- `TimbreList.vue`
- `EmotionPresetPanel.vue`
- `SfxLibraryPanel.vue`
- `BgmLibraryPanel.vue`
- `FilterLibraryPanel.vue`

### 脚本工作台域

- `ScriptWorkbenchPage.vue`
  - 页面级组合，不直接做底层 I/O
- `ScriptTabsBar.vue`
  - 多脚本切换与命名
- `CharacterPanel.vue`
  - 角色、音色绑定、音量、AI 音色分析与生成入口
- `RawScriptPanel.vue`
  - 原文输入
- `AnalyzeActionsPanel.vue`
  - 分析、插入控制块、批量生成与播放入口
- `ScriptTimeline.vue`
  - 统一渲染脚本块列表
- `DialogueLineCard.vue`
  - 单条台词块
- `BgmBlockCard.vue`
  - 单个 `BGM` 控制块
- `BgImageBlockCard.vue`
  - 单个背景图片块
- `LineWaveform.vue`
  - 波形与裁剪交互
- `LineSfxEditor.vue`
  - 台词挂载音效编辑

### Prompt 域

- `PromptSettingsPage.vue`
- `PromptTemplateEditor.vue`

## 4.5 状态与副作用边界

### `settingsStore`

负责：

- `activeTab`
- LLM 配置
- TTS 配置
- 当前选中的配置 ID
- Prompt 模板
- Prompt 开关
- `voiceDesign` 选项

禁止负责：

- 项目结构
- 资源库文件本体
- 播放状态

### `libraryStore`

负责：

- `timbres`
- `sfxLibrary`
- `bgmLibrary`
- `filterLibrary`
- `emotionPresets`

禁止负责：

- 当前脚本行
- 顺序播放状态
- 任务进度

### `projectStore`

负责：

- `scriptList`
- `currentScriptId`
- 当前脚本下的 `characters`
- 当前脚本下的 `scriptLines`
- 项目切换、脚本增删改、块增删改

说明：

- `projectStore` 是项目数据的唯一真相源。
- 当前活动脚本相关数据一律从 `scriptList + currentScriptId` 派生，不再维护重复副本。

### `playbackStore`

负责：

- 试听状态
- 当前顺序播放索引
- 舞台背景图状态
- 波形播放进度

### `jobsStore`

负责：

- 分析中
- 行音频生成中
- 批量生成中
- 导出中
- 导入中
- 视频生成中

### Service（服务层）是唯一副作用入口

组件和纯领域模块都不能直接访问：

- `fetch`
- `indexedDB`
- `localStorage`
- `AudioContext`
- `VideoEncoder`

这些只允许在 `services/` 内实现。

## 5. 必须保持不变的兼容性约束

以下内容在 P2 过程中必须保持兼容：

### 5.1 本地持久化键

- `UnitaleDB`
- `project`
- `assets`
- 当前已有 `localStorage` 键名

### 5.2 项目文件格式

- `kind: "unitale-project"`
- `schemaVersion: 3`
- `version: "3.0"`
- `scriptList`
- `currentScriptId`
- `assetKey`
- `audioAssetKey`
- `bgImageAssetKey`
- `_fileData`
- `audioBase64`
- `imageBase64`

### 5.3 模型调用协议

保持以下行为一致：

- OpenAI 兼容 `chat/completions`
- TTS `/v2/synthesize`
- 上传音频 `/v1/upload_audio`
- 检查音频 `/v1/check/audio`
- 音色设计服务 URL 结构

### 5.4 播放与导出语义

必须保持：

- 台词裁剪逻辑
- 角色音量 * 台词音量 * 音效音量 的乘法关系
- `BGM` 淡入淡出逻辑
- 顺序播放的 `bgImage` / `BGM` 预扫描行为
- `WAV` / `SRT` / `MP4` 的时间轴语义

## 6. 代码规范与可维护性约束

重构后统一遵守以下约束：

1. 单个 `.vue` 文件默认不超过 `300` 行；超过时必须证明“它仍然只有一个职责”。
2. 单个 `store` / `service` / `composable` 默认不超过 `250` 行；超过时必须拆。
3. 纯工具函数放 `utils/` 或 `domain/`，不要伪装成 Composable。
4. Composable 返回值尽量只暴露：
   - `readonly state`
   - 明确命名的 actions（动作函数）
5. 组件内不直接写业务 `fetch`。
6. 组件内不直接写 `localStorage` / `indexedDB`。
7. 组件内不直接做大块数据规范化。
8. 所有脚本块使用**判别联合类型**（discriminated union）：
   - `dialogue`
   - `bgm`
   - `bgImage`
9. 所有跨层调用都使用显式类型，不接受 `any` 漫延。
10. 不允许为了“快”把多个领域重新塞回一个超级 Store。

## 7. 分阶段执行步骤

以下步骤必须**严格顺序执行**。每一步都要通过退出条件，才能进入下一步。

### 步骤 0：冻结基线并建立“对照物”

**目标**

固定当前行为，避免重构过程中“记忆中的功能”和“真实功能”产生偏差。

**任务**

1. 保留当前 `index.html`、`project-storage.js`、`voice-design.js`。
2. 记录当前功能清单与关键路径。
3. 用 P1 固定样例工程完成一次完整手验。
4. 为关键区域补截图和操作录像：
   - 模型配置
   - 音色库
   - 音效/BGM/滤波器
   - 脚本工作台
   - Prompt 管理
5. 将当前行为视为唯一参考标准。

**输出**

- 功能清单
- 截图/录屏基线
- 可重复的 P1 回归入口

**退出条件**

- 任何人不看历史聊天，只看仓库和文档，就能知道当前系统“应该怎么工作”。

### 步骤 1：搭建 Vue/Vite 工程骨架

**目标**

建立工程化运行时，但此时**不迁移业务功能**。

**任务**

1. 初始化 `Vite + Vue 3 + TypeScript`。
2. 接入 `Pinia`、`Vitest`、`Playwright`。
3. 接入 `Tailwind` 工程配置。
4. 建立 `src/`、`tests/`、`services/`、`stores/`、`domain/` 基础目录。
5. 保留一个最薄的 `App.vue` + `AppShell.vue`。
6. 先让新工程只渲染空壳和顶部页签。

**输出**

- 可启动的新工程
- 基础 lint / test / build 命令

**退出条件**

- `dev`、`build`、`test`、`e2e` 命令都可运行。
- 新工程能显示空壳页面，但旧功能仍以旧页面为准。

### 步骤 2：先迁移领域模型与纯函数

**目标**

把最稳定、最不依赖 UI 的部分先搬出来。

**任务**

1. 将 `project-storage.js` 重写为 `TypeScript` 领域模块。
2. 定义核心类型：
   - `ProjectEnvelope`
   - `ScriptEntry`
   - `CharacterBinding`
   - `DialogueLine`
   - `BgmLine`
   - `BgImageLine`
3. 抽离纯逻辑：
   - `normalizeProjectEnvelope`
   - `stripRuntimeProjectEnvelope`
   - `createAssetKey`
   - 行工厂函数
   - 模糊匹配函数
   - 时间轴计算函数
4. 为这些纯函数补 `Vitest` 单元测试。

**输出**

- `domain/project/*`
- `domain/script/*`
- 覆盖关键纯逻辑的单元测试

**退出条件**

- `fixtures/p1-minimal-regression-project-v3.json` 能被新领域模块正确解析与规范化。
- 新旧规范化结果一致。

### 步骤 3：建立存储与外部协议服务层

**目标**

把所有 I/O 从组件世界中切出去。

**任务**

1. 封装 `IndexedDB`：
   - `projectRepository`
   - `assetRepository`
2. 封装 `localStorage`：
   - `preferenceRepository`
3. 封装模型协议：
   - `llmClient`
   - `ttsClient`
   - `voiceDesignClient`
4. 封装导入导出服务：
   - `projectImportService`
   - `projectExportService`
   - `subtitleExportService`
5. 所有 `fetch`、`JSON.parse`、`base64/blob` 转换都收敛到服务层。

**输出**

- `services/storage/*`
- `services/providers/*`
- `services/import-export/*`

**退出条件**

- 不通过组件，也能在测试或脚本中完成：
  - 读取配置
  - 读写项目
  - 导入/导出项目
  - 发起模型请求

### 步骤 4：设计并落地 Pinia Store

**目标**

明确状态所有权，停止“一个页面包办所有状态”。

**任务**

1. 建立：
   - `settingsStore`
   - `libraryStore`
   - `projectStore`
   - `playbackStore`
   - `jobsStore`
2. 只把“共享状态”放进 Store。
3. 把派生值改为 `getters` 或 `computed`。
4. 明确 Action（动作）边界，禁止组件直接改深层状态。
5. 为关键 Store 补测试。

**输出**

- 可预测的状态层

**退出条件**

- 任何一类状态都能回答“它的唯一 owner 是谁”。

### 步骤 5：先搭 UI 骨架，不迁移复杂业务

**目标**

建立页面级组件结构，但先不搬重逻辑。

**任务**

1. 实现：
   - `AppShell.vue`
   - `TopTabs.vue`
   - `GlobalToolbar.vue`
2. 实现 5 个页面壳组件：
   - 配置页
   - 音色页
   - 资源库页
   - 脚本工作台页
   - Prompt 页
3. 保持现有视觉结构和操作顺序。

**输出**

- 新工程中完整的页面骨架

**退出条件**

- 新页面结构与旧页面功能分区一一对应。
- 任何页面都不是“超级组件”。

### 步骤 6：迁移“低耦合、低风险”页面

**目标**

先迁移配置页与 Prompt 页，这两块复杂度低、回报高。

**任务**

1. 迁移模型配置页：
   - LLM 配置 CRUD
   - TTS 配置 CRUD
2. 迁移 Prompt 页：
   - Prompt 文本
   - 开关
   - 保存/重置
3. 将所有设置落到 `settingsStore + preferenceRepository`。

**输出**

- 新工程可独立使用配置页与 Prompt 页

**退出条件**

- 配置新增、编辑、删除、持久化、恢复行为与旧页面一致。

### 步骤 7：迁移资源库页面

**目标**

把资源类页面完整迁移，建立文件资产管理模式。

**任务**

1. 迁移音色库：
   - 音色增删改
   - 文件选择
   - 试听
2. 迁移情绪预设：
   - 自定义情绪
   - 启用/禁用
3. 迁移音效库：
   - 文件上传
   - 波形预览与裁剪
   - 默认音量
4. 迁移 `BGM` 库：
   - 文件上传
   - 波形预览与裁剪
   - 默认音量
5. 迁移滤波器库：
   - 类型、参数、启用状态

**输出**

- 完整资源库页面
- 统一资产注册与恢复链路

**退出条件**

- 所有资源库项在刷新后都能恢复。
- 试听、裁剪、启用开关与旧行为一致。

### 步骤 8：迁移项目与脚本基础编辑能力

**目标**

先迁移“脚本数据编辑”，暂不处理最复杂的音频编排。

**任务**

1. 迁移多脚本：
   - 新建
   - 删除
   - 切换
   - 重命名
2. 迁移角色列表：
   - 角色增删改
   - 音色绑定
   - 角色音量
3. 迁移原文输入与基本脚本块编辑：
   - 原文
   - 插入台词块
   - 插入 `BGM` 块
   - 插入背景图片块
   - 删除/排序
4. 迁移 `scriptList/currentScriptId` 的单一真相模型。

**输出**

- 不依赖音频引擎的脚本编辑工作台

**退出条件**

- 用户可以在新工程中完成“录入项目结构、维护角色、维护块列表”的全流程。

### 步骤 9：迁移 AI 分析与角色音色工作流

**目标**

把模型调用入口和脚本/角色自动生成搬进新工程。

**任务**

1. 迁移 `analyzeScript`
2. 迁移角色音色分析
3. 迁移音色设计生成
4. 统一取消、超时、错误处理逻辑
5. 保持导入后自动音色同步逻辑兼容

**输出**

- AI 分析工作流
- AI 音色生成工作流

**退出条件**

- 新工程可完成：
  - AI 分析小说
  - 生成脚本块
  - 生成/绑定 AI 音色

### 步骤 10：迁移音频预览、波形与台词生成

**目标**

把最关键的音频运行时迁移出来。

**任务**

1. 抽 `playbackEngine`
2. 抽 `previewService`
3. 迁移：
   - 台词生成
   - 单条播放
   - 资源试听
   - 波形绘制
   - 裁剪拖拽
   - 音效叠加
   - 滤波器应用
4. 将 `AudioContext`、`Buffer`、`URL.createObjectURL` 全部收敛到服务层。

**输出**

- 可复用的音频引擎层

**退出条件**

- 单条生成、单条试听、裁剪、角色音量、音效音量、滤波器行为与旧页面一致。

### 步骤 11：迁移顺序播放、批量生成与舞台预览

**目标**

完成编排型逻辑迁移。

**任务**

1. 迁移批量生成
2. 迁移清空全部音频
3. 迁移顺序播放
4. 迁移：
   - `bgImage` 预扫描
   - `BGM` 预扫描
   - 当前播放索引
   - 舞台背景图淡入
5. 建立 `playbackStore` 统一管理运行态

**输出**

- 完整的工作台播放链路

**退出条件**

- 从任意选中行开始播放、从任意选中行开始批量生成都与旧逻辑一致。

### 步骤 12：迁移导入导出与视频导出

**目标**

完成最高风险的最终闭环。

**任务**

1. 迁移导入完整工程
2. 迁移导出完整工程
3. 迁移导出 `SRT`
4. 迁移导出 `WAV`
5. 迁移生成 `MP4`
6. 保持：
   - 内嵌 `data URI` 提取逻辑
   - 资源恢复逻辑
   - 时间轴一致性

**输出**

- 完整离线工作流

**退出条件**

- P1 固定样例工程可以在新工程中：
  - 导入
  - 刷新恢复
  - 导出 `SRT`
  - 导出音频
  - 生成视频

### 步骤 13：切换主入口并保留旧实现作为归档

**目标**

在新工程通过验收后，正式切换默认入口。

**任务**

1. 将新工程设为默认开发入口。
2. 旧 `index.html` 重命名为：
   - `legacy-index-reference.html`
   - 或放入 `legacy/`
3. 在 `README` 中更新运行方式。
4. 保留迁移说明与已知兼容性注意事项。

**输出**

- 新工程成为正式实现
- 旧实现成为行为归档与回溯参考

**退出条件**

- 新入口可替代旧入口进行日常开发。

### 步骤 14：清理与收尾

**目标**

消除技术债残留，避免“看似重构完成，实则半旧半新”。

**任务**

1. 删除新工程中未使用的兼容胶水代码。
2. 统一命名、注释、类型别名。
3. 清理重复工具函数。
4. 补齐开发文档：
   - 目录说明
   - Store 职责
   - Service 职责
   - 导入导出兼容说明
5. 对照本计划逐项复核。

**退出条件**

- 仓库里不存在“只有作者自己能看懂”的临时层。

## 8. 验收策略

## 8.1 验收分层

### 第一层：纯逻辑单元测试

覆盖：

- schema 规范化
- runtime 字段剥离
- 角色/音色匹配
- LLM 返回解析
- 时间轴计算
- 波形裁剪换算

### 第二层：Store / Service 测试

覆盖：

- 项目读写
- 资源读写
- 设置持久化
- 导入导出服务
- Provider 客户端请求拼装

### 第三层：组件黑盒测试

覆盖：

- 表单交互
- 块编辑
- 角色绑定
- 按钮状态

### 第四层：Playwright 端到端回归

至少覆盖：

1. 导入样例工程 -> 刷新 -> 断言资源与脚本恢复
2. 清除首条台词 -> 重新生成 -> 刷新 -> 断言音频恢复
3. 导出 `SRT`
4. 导出 `WAV`
5. 生成 `MP4`

## 8.2 每一步必须通过的检查

每个阶段合并前必须至少通过：

1. `typecheck`
2. `unit tests`
3. 与该阶段相关的 `Playwright` 用例
4. 人工对照旧页面行为

## 9. 迁移过程中的禁止事项

以下行为在 P2 中禁止：

1. 一边重构，一边改协议
2. 一边重构，一边改 UI 结构
3. 一边重构，一边改项目 schema
4. 将旧的超大函数直接复制进单个新组件
5. 组件直接访问 `indexedDB`、`localStorage`、`fetch`
6. 未建立测试即删除旧实现
7. 以“后面再整理”为理由先引入 `any`
8. 为了省事把所有状态都塞进一个 Store

## 10. 最终完成标准

当且仅当以下条件全部满足，P2 才算完成：

1. 新工程已取代旧 `index.html` 成为默认实现。
2. P1 固定样例工程可在新工程中完整跑通。
3. 模型配置、资源库、脚本编辑、AI 分析、音色生成、台词生成、顺序播放、`WAV/SRT/MP4` 导出全部可用。
4. 项目导入导出与本地恢复保持兼容。
5. 所有核心状态都有明确 owner。
6. 所有副作用都有明确服务层归属。
7. 任一核心模块都可以在不打开整个工程的情况下被单独阅读与理解。

## 11. 一句话执行原则

**先把数据和副作用拆干净，再把界面拼回来；先让每一步都可验收，再谈“整体完成”。**
