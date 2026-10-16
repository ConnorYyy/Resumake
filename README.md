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

`public/og-image.png` 是 1200×630 的对外分享图，源文件为 `scripts/og-image.html`。改动后重新生成：

1. `npm run dev`
2. 打开 `http://localhost:5173/scripts/og-image.html`
3. 把浏览器视口设为 1200×630，截图（设备像素比为 1），保存覆盖 `public/og-image.png`
4. `index.html` 与 `zh/index.html` 中的 `og:image` / `twitter:image` 已指向该文件

## 赞助入口

`VITE_BMC_URL` 指向 Buy Me a Coffee 主页；留空则界面上不显示任何赞助入口。软文与文案见 `docs/buymeacoffee.md`。

## 数据与隐私

所有简历数据只保存在当前浏览器中，应用不会把内容上传到服务器。清除浏览器数据会导致简历丢失，建议定期导出 JSON 备份。

编辑器与落地页接入了 Sentry 用于发现线上崩溃，但上报内容**严格限定为程序异常本身**：不含简历内容、表单字段或照片；客户端也不发送用户信息（IP）、Cookie、请求头/请求体、URL 查询参数与栈帧局部变量，且不记录面包屑与会话统计（Sentry 服务端仍可能按连接 IP 推断国家/城市级别的地理位置，当前未开启其"不存储 IP"设置）。实现见 `src/services/telemetry.ts`（发送前统一清洗）与 `src/services/telemetryScrub.ts`。把 `VITE_SENTRY_DSN` 留空即可整体关闭上报。

## 文档

以下文档位于 `docs/`，仅保留在本地工作副本中（该目录已加入 `.gitignore`，不随仓库发布）：

- 产品需求文档（PRD）：`docs/PRD.md`
- Buy Me a Coffee 主页文案：`docs/buymeacoffee.md`
- 域名候选清单：`docs/domain-shortlist.md`
