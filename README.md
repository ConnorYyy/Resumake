<p align="center">
  <img src="public/logo.svg" alt="Resumake logo" width="96" height="96" />
</p>

<h1 align="center">Resumake</h1>

<p align="center">基于 HTML 模板的个人简历生成与 PDF 导出 Web 应用</p>

---

## 功能

- **内置模板**：经典、现代、极简三套模板，支持中文与英文内容。
- **两种编辑方式**：表单填写，或直接编辑 HTML 代码与 CSS 主题。
- **日期选择器**：工作/教育/项目时间用「年 + 月」选择，可勾选「至今」；日期格式随语言切换（中文 `2020.07` / `2020年7月`，英文 `2020.07` / `07.2020` / `Jul 2020`）。
- **可自定义分区**：每个模块的名称可改写（按语言分别保存），模块顺序可整体上移/下移。
- **个人照片**：上传后自动裁剪为 3:4 证件照比例，可选居左、居中、居右。
- **主题色**：内置多种颜色，也可以在弹窗中输入 `rgb(r, g, b)` 自定义。
- **字号缩放**：正文可在 80%–120% 之间调整（步长 5%），或一键「压缩到一页」。
- **实时预览**：A4 / Letter 纸张模拟，支持缩放，并显示分页位置。
- **格式体检**：导出前检查缺姓名/联系方式、超过一页、被切断的内容与空白条目。
- **撤销/重做**：表单与设置改动可用快捷键回退（输入框内保留浏览器原生撤销）。
- **导出 PDF**：通过浏览器打印生成，文本可选中，超链接可点击。
- **数据管理**：内容自动保存在本地浏览器中，支持导入、导出 JSON 和导出 HTML。

## 快速开始

需要 Node.js 18 或更高版本。

```bash
npm install
npm run dev       # 开发服务器，默认 http://localhost:5173
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查并构建到 `dist/` |
| `npm test` | 运行单元测试 |
| `npm run preview` | 预览构建结果 |

## 环境变量

复制 `.env.example` 为 `.env.local` 后按需填写（`.env.local` 不入库）：

| 变量 | 说明 |
| --- | --- |
| `VITE_BMC_URL` | Buy Me a Coffee 赞助链接，留空则不显示入口 |
| `VITE_SENTRY_DSN` | 崩溃上报的 Sentry DSN；留空则完全不上报 |
| `VITE_SENTRY_DEV` | 设为 `1` 时本地开发也上报（仅用于验证接入） |
| `SENTRY_AUTH_TOKEN` | 构建时上传 source map 用，只在 `npm run build` 读取，不会进入前端产物 |
| `SENTRY_ORG` / `SENTRY_PROJECT` | 上传 source map 的目标组织与项目 |

## 项目结构

```
src/
├── components/   界面组件（工具栏、表单、代码编辑、预览、主题色选择）
├── engine/       模板渲染、CSS 过滤、文档组装、导入校验、日期格式化、分页测量
├── templates/    内置模板（HTML 结构与 CSS）
├── stores/       Pinia 状态管理（含撤销/重做历史）
├── storage/      IndexedDB 本地存储
├── services/     JSON / HTML 导入导出、照片处理
└── data/         示例数据与表单字段定义
public/logo.svg   应用 Logo
public/og-image.png 社交分享图（1200×630）
scripts/og-image.html 分享图源文件
docs/             产品文档（PRD、赞助文案、域名候选），不纳入版本管理
README.md         项目说明
```

## 社交分享图（og:image）

每个页面都有独立的 1200×630 分享图，放在 `public/og/`（如 `og-home.jpg`、`og-zh.jpg`、`og-ats.jpg`），
分别被对应页面的 `og:image` / `twitter:image` 引用。它们是 Canvas 绘制的（深色渐变 + 网格 + 品牌 + 页面标题），
不依赖外部图片或字体文件。

改动文案后重新生成：

1. `npm run dev`
2. 打开 `http://localhost:5173/scripts/og-variants.html`
3. 点「全部下载」，把得到的 `og-*.jpg` 覆盖到 `public/og/`

`public/og-image.png` 是最早的通用兜底图，源文件为 `scripts/og-image.html`。

## 404 与图标

| 文件 | 作用 |
| --- | --- |
| `404.html` | 未匹配路径的兜底页（`wrangler.toml` 的 `not_found_handling = "404-page"`），带 `noindex` |
| `public/favicon.ico` | 32×32，浏览器默认请求 `/favicon.ico` 时使用 |
| `public/apple-touch-icon.png` | 180×180，iOS 添加到主屏时自动识别 |
| `public/templates/*.webp` | `/templates/` 的三套模板预览图，由编辑器真实渲染后抓取 |

## 安全响应头

`public/_headers` 由 Cloudflare Workers 的静态资源层解析，对全部资源生效：

| 头 | 值 | 作用 |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | 禁止浏览器猜测 MIME 类型 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 跨站只发送 origin |
| `X-Frame-Options` | `DENY` | 禁止被 iframe 嵌套 |
| `Permissions-Policy` | 关闭相机 / 麦克风 / 定位 | 最小权限 |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | 一年内强制 HTTPS |

HSTS **没有** 加 `preload`：它需要向浏览器厂商提交名单，且移除周期很长。
需要回滚时把 `max-age` 调小（例如 `300`）并重新部署，等浏览器里的旧策略自然过期即可。

## 每日用量快照

`scripts/snapshot-usage.mjs` 把页面浏览与事件计数按天写入 `data/usage-daily.csv`，
并由 `.github/workflows/usage-snapshot.yml` 每天 01:20 UTC 自动运行、提交。
部署工作流用 `paths-ignore` 忽略 `data/**`，所以数据提交不会触发重复构建。各列含义见 `data/README.md`。

## 赞助入口

`VITE_BMC_URL` 指向 Buy Me a Coffee 主页；留空则界面上不显示任何赞助入口。软文与文案见 `docs/buymeacoffee.md`。

## 数据与隐私

所有简历数据只保存在当前浏览器中，应用默认不会把内容上传到服务器。唯一的例外是编辑器里的**可选**「AI 优化」按钮：只有你主动点击时，才会把你正在编辑的那一段文字发送给 AI 服务并返回改写结果，不会发送照片、联系方式或其他分节，结果也不会被保存（`worker/ai.ts`）。清除浏览器数据会导致简历丢失，建议定期导出 JSON 备份。

编辑器与落地页接入了 Sentry 用于发现线上崩溃，但上报内容**严格限定为程序异常本身**：不含简历内容、表单字段或照片；客户端也不发送用户信息（IP）、Cookie、请求头/请求体、URL 查询参数与栈帧局部变量，且不记录面包屑与会话统计（Sentry 服务端仍可能按连接 IP 推断国家/城市级别的地理位置，当前未开启其"不存储 IP"设置）。实现见 `src/services/telemetry.ts`（发送前统一清洗）与 `src/services/telemetryScrub.ts`。把 `VITE_SENTRY_DSN` 留空即可整体关闭上报。

访问量统计使用 **Cloudflare Web Analytics**：无 Cookie、不跨站追踪、不采集个人信息，只提供聚合的页面浏览量。脚本标签直接写在 `index.html`、`zh/index.html`、`app/index.html` 里，删掉那段 `<script>` 即可彻底关闭统计。

功能使用计数（"编辑器被打开" / "PDF 被导出"）由 `worker/index.ts` 处理：前端以 `POST /api/event/<事件名>` 的形式发送，Worker 校验白名单后返回 204，**请求本身即被 Cloudflare 边缘统计记录**。只上报事件名，**不含简历内容、Cookie 或任何身份标识**，数据留在自己的 Cloudflare 账号内，不经过第三方，也不需要数据库。前端发送逻辑见 `src/services/usage.ts`，本地开发（非 PROD）不发送。想关闭：移除 `trackUsage()` 调用即可（Worker 中没有命中事件路径时会照常回落静态资源）。

## AI 优化（可选）

编辑器里每个长文本输入框右下角的 `✦ AI` 按钮。**按钮是否显示由运行时探测决定**：前端请求 `GET /api/ai/status`，Worker 配了 key 才返回 `{ enabled: true }`，因此不存在「按钮在但接口没配置」的错位，也不需要重新构建前端。

| 项目 | 说明 |
| --- | --- |
| 本地启用 | 在 `.env.local` 写 `OPENCODE_GO_API_KEY=...`，dev server 的中间件会读取并直接调用模型 |
| 生产启用 | `npx wrangler secret put OPENCODE_GO_API_KEY`（或控制台添加 Secret） |
| 临时关闭 | 删掉这个 Secret 即可：`/api/ai/status` 返回 `enabled: false`，按钮自动消失 |
| 模型 | 默认 `deepseek-v4.1-flash`，失败时兜底 `mimo-v2.6-flash`；可用 `AI_MODEL` / `AI_FALLBACK_MODEL` 覆盖 |
| 限制 | 输入 600 字符、每 IP 12 次/分钟、单次超时 12 秒 |
| 发送内容 | 只有用户点按钮时选中的那段文字 + 语言 + 字段名，不含照片、联系方式或其他分节 |
| 实现 | 服务端 `worker/ai.ts`，前端 `src/services/aiRewrite.ts` + `src/components/AiTextarea.vue` |

## 文档

以下文档位于 `docs/`，仅保留在本地工作副本中（该目录已加入 `.gitignore`，不随仓库发布）：

- 产品需求文档（PRD）：`docs/PRD.md`
- Buy Me a Coffee 主页文案：`docs/buymeacoffee.md`
- 域名候选清单：`docs/domain-shortlist.md`
