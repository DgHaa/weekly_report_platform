# 周报协作平台（Weekly Report Collaboration Platform）

多人在线协作周报编辑 / 汇总 / 导出平台。实现对齐自 `周报协作平台-需求规格PRD.md`。

## 技术栈
- 前端：React 18 + Vite + TypeScript + Tiptap（富文本）+ Yjs（实时协作，CRDT）
- 后端：Node.js + Express + better-sqlite3
- 实时通道：y-websocket（WebSocket）
- 导出：Playwright（PDF）、自建 RFC822 `.eml`（Outlook 兼容）、独立 HTML
- 鉴权：JWT

> 注：后端默认端口 **8000**（可通过环境变量 `PORT` 覆盖）。

## 目录
```
weekly-report-platform/
├── src/                 # 后端（Express + WS + SQLite）
│   ├── db.js            # Schema + 默认部门 + admin 种子
│   ├── routes/          # auth / weeklyReports / versions / attachments / export
│   ├── export/          # html / eml / pdf 生成
│   └── collab.js        # y-websocket 引导
├── client/              # 前端（Vite + React）
│   └── src/components/  # 列表 / 编辑器 / 看板 / 版本 / 富文本
├── data/weekly.db       # SQLite 数据库（运行时生成）
└── uploads/             # 图片附件
```

## 运行

> **环境要求**：Node.js 18+（推荐 20 / 22，已用 `.nvmrc` 声明）。后端依赖 `better-sqlite3` 为原生模块，需与本机 Node 版本 ABI 匹配；若 `npm install` 报原生编译错误，请升级 Node 或安装 Python3 + 构建工具后重试。

### 开箱即用（推荐）
克隆后只需两条命令，全部功能（界面 + HTML / PDF / 邮件导出）即可运行：
```bash
npm install     # 安装后端依赖，并自动安装前端依赖（postinstall）
npm start        # 首次自动构建前端 + 自动下载 PDF 所需 Chromium，然后启动服务
```
启动后浏览器打开 **http://localhost:8000** 即可看到完整界面。
- 前端依赖由 `postinstall` 脚本自动装好，无需手动 `cd client && npm install`。
- 首次 `npm start` 会自动 `vite build` 生成 `client/dist`；以后仅改后端代码时秒启。
- 首次 `npm start` 会自动下载 PDF 导出所需的 Chromium（一次性，约 100MB，存于系统缓存，不入库）；若下载失败仅 PDF 不可用，HTML / 邮件导出仍正常。
- 数据库 `data/weekly.db` 在启动时自动创建并写入默认 4 个部门与管理员。

默认管理员：`admin / admin123`

### 开发模式（热更新）
```bash
npm install
npm run dev       # 用 concurrently 同时拉起后端(:8000) 与前端(:5173，支持热更新)
```
启动后浏览器打开 **http://localhost:5173**（Vite 会把 /api、/collab 请求代理到后端 8000）。

> 如果前端依赖安装卡住/报错，详见 [`docs/依赖手动安装指南.md`](./docs/依赖手动安装指南.md)。

### 生产构建（前后端一体，手动）
```bash
npm install
npm run build     # 生成 client/dist（也可直接 npm start，会自动构建）
npm start          # http://localhost:8000 直接访问前端
```

## 功能覆盖
- 周报 CRUD、周期标识(唯一)、状态机 draft→collecting→published（仅管理员推进）
- 部门(默认4个/可增删) + 工作项(标题/本周进展/下周计划富文本)
- Yjs 实时协作 + 可见光标；30s 自动存稿 + 未保存提示
- 工作项状态 未填写→未更新→已更新（编辑进展自动推进）
- 进度看板 X/Y、按状态筛选
- 整份周报版本快照、对比(高亮差异)、恢复
- 导出 HTML / PDF(A4) / `.eml`（Outlook 兼容表格 HTML + CID 内联图片），支持 5 套视觉主题（经典蓝紫 / 商务深蓝 / 清新青绿 / 暖橙活力 / 打印单色）
- 编辑历史审计（谁/何时/改了哪个字段）
- 编辑器左侧目录导航（模块 / 部门 / 工作项 / 关键专项进展），一键定位滚动
- 关键专项进展支持多条独立可编辑框（标题 + 富文本，可增删 / 排序）
- 编辑器内置「预览」模式，可实时切换并预览导出主题风格（风格随周报持久化）

## 已知限制
- 实时协作文档在服务端内存中转发，未做 Yjs 持久化到 SQLite（以 30s REST 存稿为持久来源）；服务重启后从 DB 重载。
