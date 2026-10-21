#!/usr/bin/env node
/**
 * 每日用量快照。
 *
 * Cloudflare 的边缘统计与 Web Analytics 都有留存上限，跑久了早期数据就查不到了。
 * 这个脚本把「页面浏览 / 访问 / 编辑器打开 / 导出 PDF」按天落成 CSV 提交进仓库，
 * 让趋势可以长期保留。由 .github/workflows/usage-snapshot.yml 每天跑一次。
 *
 * 每次都回看最近 7 天并与已有 CSV 合并，这样晚到的数据也能被补齐。
 * 注意：这里的日期是 UTC。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '0df835e862cfdbfc4d554afb1c55455f';
const ZONE_ID = process.env.CF_ZONE_ID || '48189e83172bc5d94ca2ac3b13e6401b';
const RUM_SITE_TAG = process.env.CF_RUM_SITE_TAG || '0ec0bfb36d02422696b9eacdb751fdb1';

const OUT = 'data/usage-daily.csv';
const LOOKBACK_DAYS = 7;
const HEADER = 'date,pageviews,visits,editor_open,export';

if (!TOKEN) {
  console.error('缺少 CLOUDFLARE_API_TOKEN 环境变量');
  process.exit(1);
}

const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

async function gql(query) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data.viewer;
}

const QUERY = `query {
  viewer {
    zones(filter: {zoneTag: "${ZONE_ID}"}) {
      events: httpRequestsAdaptiveGroups(
        limit: 500
        filter: {
          datetime_geq: "${since}"
          clientRequestPath_like: "/api/event/%"
          edgeResponseStatus: 204
        }
      ) {
        count
        dimensions { date clientRequestPath }
      }
    }
    accounts(filter: {accountTag: "${ACCOUNT_ID}"}) {
      rum: rumPageloadEventsAdaptiveGroups(
        limit: 500
        filter: { siteTag: "${RUM_SITE_TAG}", datetime_geq: "${since}" }
      ) {
        count
        sum { visits }
        dimensions { date }
      }
    }
  }
}`;

function readExisting() {
  if (!existsSync(OUT)) return new Map();
  const lines = readFileSync(OUT, 'utf8').trim().split(/\r?\n/);
  const out = new Map();
  for (const line of lines.slice(1)) {
    const [date, pv, uv, open, exp] = line.split(',');
    if (!date) continue;
    out.set(date, {
      pageviews: Number(pv) || 0,
      visits: Number(uv) || 0,
      editor_open: Number(open) || 0,
      export: Number(exp) || 0,
    });
  }
  return out;
}

const data = await gql(QUERY);
const zone = data.zones[0];
const account = data.accounts[0];

const rows = readExisting();
const blank = () => ({ pageviews: 0, visits: 0, editor_open: 0, export: 0 });

for (const row of account.rum ?? []) {
  const date = row.dimensions.date;
  const entry = rows.get(date) ?? blank();
  entry.pageviews = row.count;
  entry.visits = row.sum?.visits ?? 0;
  rows.set(date, entry);
}

for (const row of zone.events ?? []) {
  const date = row.dimensions.date;
  const name = row.dimensions.clientRequestPath.replace('/api/event/', '');
  if (name !== 'editor_open' && name !== 'export') continue;
  const entry = rows.get(date) ?? blank();
  entry[name] = row.count;
  rows.set(date, entry);
}

const dates = [...rows.keys()].sort();
const body = dates
  .map((d) => {
    const r = rows.get(d);
    return `${d},${r.pageviews},${r.visits},${r.editor_open},${r.export}`;
  })
  .join('\n');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${HEADER}\n${body}\n`, 'utf8');

console.log(`已写入 ${OUT}（${dates.length} 天）`);
for (const d of dates.slice(-LOOKBACK_DAYS)) {
  const r = rows.get(d);
  console.log(`  ${d}  pv=${r.pageviews} uv=${r.visits} open=${r.editor_open} export=${r.export}`);
}
