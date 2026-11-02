#!/usr/bin/env node
/**
 * IndexNow 推送：把 sitemap 里的 URL 主动告知 Bing / Yandex / Seznam。
 *
 * 为什么需要它：Google 之外，Bing 的索引还会喂给 DuckDuckGo、Yahoo 和 Copilot。
 * 这三个引擎都支持 IndexNow —— 不需要账号，只要站点根目录存在
 * `<key>.txt`（内容与 key 完全一致），然后 POST 一次 URL 列表即可。
 *
 * 用法（构建之后运行，读 dist/sitemap.xml）：
 *   node scripts/indexnow.mjs
 *   node scripts/indexnow.mjs --dry-run
 *
 * 参考：https://www.indexnow.org/documentation
 */

import { existsSync, readFileSync } from 'node:fs';

const SITE = 'https://resumake.online';
const HOST = 'resumake.online';
const KEY = '0c191a4cdb4ae4069e6a81e7b2619fee';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const dryRun = process.argv.includes('--dry-run');

function readSitemapUrls() {
  const path = 'dist/sitemap.xml';
  if (!existsSync(path)) {
    throw new Error('找不到 dist/sitemap.xml，请先执行 npm run build');
  }
  const xml = readFileSync(path, 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (!urls.length) throw new Error('sitemap 里没有 URL');
  return urls;
}

const urlList = readSitemapUrls();
console.log(`IndexNow: 准备推送 ${urlList.length} 个 URL`);
urlList.forEach((u) => console.log(`  ${u}`));

if (dryRun) {
  console.log('dry-run，未发送');
  process.exit(0);
}

const body = {
  host: HOST,
  key: KEY,
  keyLocation: `${SITE}/${KEY}.txt`,
  urlList,
};

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

// 200/202 = 已接受；422 = key 或 URL 不合法；403 = key 文件校验失败
if (res.status === 200 || res.status === 202) {
  console.log(`IndexNow: 已提交（HTTP ${res.status}）`);
} else {
  const text = await res.text().catch(() => '');
  console.error(`IndexNow: 失败 HTTP ${res.status} ${text.slice(0, 200)}`);
  process.exit(1);
}
