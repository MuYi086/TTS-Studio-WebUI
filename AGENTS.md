# Repository Guidelines

## 项目定位

- 这是一个无构建步骤的静态 WebUI，根目录 [`index.html`](index.html) 是唯一运行入口。Vue 3、Tailwind CSS 和 `mp4-muxer` 通过 CDN 加载，页面模板、状态、请求、播放和导出逻辑仍集中在这个单文件中。
- `webUI/` 已废弃；不要向其中新增、恢复或引用功能。仓库没有 `package.json`、npm 脚本、覆盖率门槛或独立测试目录。
- 代码和文档优先使用中文；代码标识符、接口字段、端口和第三方命令保留原文。

## 目录职责

- [`index.html`](index.html)：Vue 应用、页面模板、Prompt、LLM/TTS/音色设计调用、Web Audio 播放、SoundEffect 编排、工程导入导出和 WAV/SRT/MP4 导出。
- [`js/project-storage.js`](js/project-storage.js)：工程协议规范化与旧数据迁移；当前 `PROJECT_KIND` 为 `unitale-project`，`PROJECT_SCHEMA_VERSION` 为 `4`。
- [`js/voice-design.js`](js/voice-design.js)：音色设计服务目录。当前默认目录是 Qwen `8301`、MOSS `8302`、MiMo `8303`；不要把目录索引写死到业务逻辑。
- [`js/soundeffect-client.js`](js/soundeffect-client.js)：MOSS-SoundEffect `8312` 和 Stable Audio 3 Medium `8311` 的请求封装，只处理模型路由和 WAV 响应校验。
- [`js/bgm-client.js`](js/bgm-client.js)：ACE-Step 1.5 `8313` 的 BGM 请求封装；生成的 Blob 由 `index.html` 写入既有 `bgmLibrary` 和 IndexedDB。
- [`js/spatial-schema.js`](js/spatial-schema.js)：有限空间语义 DSL 与默认值；`project-storage.js` 是持久化规范化的唯一入口，工程版本仍为 4。
- [`js/spatial-compiler.js`](js/spatial-compiler.js)：把现有时间线确定性编译为 Manifest v1，必须保留独立对象，不能预混。
- [`js/steam-audio-client.js`](js/steam-audio-client.js)：8300 正式 Steam Audio multipart 客户端；`spatial-timeline.js` 只用于 Web Audio 近似预览。
- [`editConfig/`](editConfig/)：Step-Audio-EditX 的 emotion、paralinguistic、speaking style 词表。目前台词 `emotion` 与 EditX 编辑流程实际使用 emotion 词表；其他词表是独立配置，不要未经实现就宣称已有页面入口。
- [`docs/`](docs/)：本地开发、回归、后端接入和模型实践说明；模型接口变更时优先同步对应文档。
- [`Design/`](Design/)：视觉参考图，不是运行时资源。

## 运行与验证

在仓库根目录启动静态服务：

```bash
python3 -m http.server 5173
```

访问 `http://127.0.0.1:5173/index.html`。也可以使用仓库现有的 VS Code Live Server 配置，端口为 `5502`；修改 `.vscode/settings.json` 后需重启 Live Server。

修改 `index.html`、外部脚本或配置脚本后，至少执行语法检查；模型接口变更还要核对 `8300/8301/8302/8303/8311/8312/8313/8321/8322/8323/8324/8331` 与后端 `start.sh` 一致：

```bash
node -e "const fs=require('fs');const files=['index.html','js/project-storage.js','js/voice-design.js','js/soundeffect-client.js','js/bgm-client.js','editConfig/emotion.js','editConfig/paralinguistic.js','editConfig/speakingStyle.js'];for(const file of files){const source=fs.readFileSync(file,'utf8');if(file==='index.html'){for(const match of source.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)){if(match[1].trim())new Function(match[1]);}}else new Function(source);console.log('syntax ok:',file)}"
node --test js/*.test.js
```

涉及页面、IndexedDB、播放、音效、导入导出或后端请求的改动，还必须启动浏览器手动回归；需要在线模型的场景按 [`docs/TTS-and-VoiceDesign接入.md`](docs/TTS-and-VoiceDesign接入.md) 连接真实本地服务验证，不能把未实际调用的后端能力写成前端现状。

## 数据与兼容性红线

- 不得更换 `UnitaleDB`、`project.currentState`、`assets`、旧 `localStorage` 键或工程 schema。运行时 `audioUrl`、对象 URL、AbortController 等字段不能写入工程快照。
- 工程导入导出优先复用 `UnitaleProjectStorage`。完整工程 JSON 会内嵌 BGM、音色、台词原音频、Step-Audio-EditX 音频和 SoundEffect WAV；模型配置不随工程导入覆盖。
- 稳定 `audioAssetKey` 只用于 IndexedDB 查找，不得拼成 `/voice/<assetKey>`。新生成或替换音频应覆盖对应稳定键，并正确回收对象 URL 和解码缓存；BGM 时间轴块可用 `audioAssetKey` 直接绑定生成音频，播放/导出应优先按键解析、名称仅作旧工程回退。
- 当前时间轴只允许 `dialogue` 与 `bgm`。旧 `bgImage` 块导入时忽略，旧 `sfx` / `filter` 字段不应恢复；音效计划只能写在 `dialogue.sfx_plan` 中，最多保留两项并各自绑定音频资产。
- `standard` 导出可以使用旧预混总线；`balanced`/`immersive` 必须把 Manifest 和独立对象 Blob 发送到 `/v1/audio/spatial/render`。不得把 Web Audio 近似预览或旧 Haas/aecho 总线冒充正式空间成品。
- 保持 `dialogue` 的 `trimStart`、`trimEnd`、`speed`、`break_duration`、`dialogueVolume`、`sfxVolume` 语义。`break_duration` 是台词后的时间轴停顿，不是音效时长。
- VoxCPM2 的 `clone_mode`、`delivery_profile`、`control_instruction`、`voxcpm_nonverbal_tags` 与通用 `emotion` / `intensity` 是不同语义，不能混用。Step-Audio-EditX 编辑结果必须与原始台词音频分开保存。
- 不要提交 API Key、浏览器导出的工程数据、生成音频或本机模型产物。修改前先运行 `git status --short`，保留无关改动。

## 编码约定

保持现有 JavaScript 风格：4 空格缩进、分号、`camelCase`、`UPPER_SNAKE_CASE` 常量；避免无关格式化。新增逻辑按“配置与 Prompt、存储兼容、模型调用、播放导出、页面展示”归类，转换与迁移逻辑集中放在已有规范化入口，不在模板中复制一套 schema。

修改 Prompt 时同时检查默认模板、变量替换、旧自定义模板迁移和 LLM 返回解析；修改模型接口时同时检查 URL、请求体、响应 MIME、取消逻辑、错误提示和在线接入文档。

## 提交与交接

Git 提交沿用 `feat:`、`fix:` 等 Conventional Commits 前缀，首行用中文简述并保持单一目的。PR 或交接说明应包含：改动范围、兼容性影响、已执行的语法检查和手动回归；UI 改动附截图，依赖本地后端的改动注明端口、接口、模型权重和未覆盖的在线条件。
