# Usage snapshots

`usage-daily.csv` 由 `scripts/snapshot-usage.mjs` 每天自动生成，并通过
`.github/workflows/usage-snapshot.yml` 提交。

| 列 | 含义 | 来源 |
| --- | --- | --- |
| `date` | UTC 日期 | — |
| `pageviews` | 页面浏览数 | Cloudflare Web Analytics（真实执行 JS 的浏览器） |
| `visits` | 会话数 | 同上 |
| `editor_open` | 编辑器被打开的次数 | 站点自己的匿名计数（`/api/event/editor_open`） |
| `export` | 点击导出 PDF 的次数 | 同上 |

## 解读注意

- 这个文件的作用是**长期留存**：Cloudflare 的边缘统计有留存上限，过期就查不到了。
- `pageviews` 不含只抓 HTML 的机器人（它们不执行 JS），但仍可能包含无头浏览器。
- **2026-10-18 与 2026-10-21 的 `editor_open` / `export` 包含开发期的自测请求**，不是真实用户；从 10-22 起才是干净数据。
- 每次运行会回看最近 7 天并覆盖合并，所以晚到的数据会自动补齐。
