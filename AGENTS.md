# Repository Guidelines

## 项目结构与职责

- 根目录 [`index.html`](index.html) 是当前唯一开发入口：Vue 3 通过 CDN 加载，页面、状态和主要业务逻辑集中在一个单文件中。
- [`project-storage.js`](project-storage.js) 负责工程与 IndexedDB（浏览器本地数据库）兼容；[`voice-design.js`](voice-design.js) 管理音色设计目录；[`soundeffect-client.js`](soundeffect-client.js) 封装音效请求。
- [`editConfig/`](editConfig/) 保存 Step-Audio-EditX 的情绪、拟声和表达风格配置；[`Design/`](Design/) 保存界面参考图；[`docs/`](docs/) 保存本地开发、回归和后端接入说明。
- `webUI/` 已废弃，不要向其中新增或恢复功能。本仓库没有 `package.json`、构建脚本或独立测试目录。

## 开发、构建与验证

仓库是静态 WebUI，无需构建。根目录启动本地服务：

```bash
python3 -m http.server 5173
```

然后访问 `http://127.0.0.1:5173/index.html`。修改 `index.html` 后至少运行内联脚本语法检查：

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)){if(match[1].trim())new Function(match[1]);}"
```

当前没有 npm test、覆盖率门槛或自动化测试框架；涉及页面、存储、播放或导出的改动须在浏览器手动回归。后端在线链路需按 [`docs/TTS-and-VoiceDesign接入.md`](docs/TTS-and-VoiceDesign接入.md) 使用本地服务验证，不能把未实际调用的后端能力写成前端现状。

## 编码与命名约定

使用现有 JavaScript 风格：4 空格缩进、分号、`camelCase` 变量/函数名、`UPPER_SNAKE_CASE` 常量；保持 Vue 模板、`setup` 逻辑和现有分区注释的组织方式。没有统一 formatter 或 linter，避免无关格式化。新增转换逻辑应集中复用，按“配置与 Prompt、存储兼容、模型调用、播放导出、页面展示”归类维护。

## 兼容性与数据安全

不得破坏 `UnitaleDB`、旧 `localStorage` 键、工程 schema、资产键，以及 `dialogue`、`bgm`、`bgImage` 的时间轴语义。工程导入导出优先复用 `project-storage.js`。修改前运行 `git status --short`，不得覆盖无关改动；不要提交 API Key、浏览器数据或生成音频。

## 提交与 Pull Request

Git 历史主要采用 `feat:`、`fix:` 等 Conventional Commits（约定式提交）前缀，例如 `feat: 增加longCat模型`。提交应保持单一目的，首行用中文简述。PR 应说明改动范围、兼容性影响和已执行的验证命令；UI 改动附截图，依赖本地后端的改动注明端口、接口和未覆盖的在线条件，并同步更新相关 `README.md` 或 `docs/`。
