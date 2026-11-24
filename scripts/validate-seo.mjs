#!/usr/bin/env node
/**
 * 构建产物 SEO 体检（无第三方依赖）。
 *
 *   node scripts/validate-seo.mjs dist
 *
 * 检查：title / description / h1 唯一性、canonical、JSON-LD 语法与类型、
 *      可见 FAQ 与 FAQPage 文本是否一致、站内链接是否指向存在的页面、
 *      图片 alt、重复 title。
 *
 * 有任何 problem 时退出码为 1，方便放进 CI。
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] || 'dist';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const norm = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
}

const pages = walk(root).map((file) => {
  const html = readFileSync(file, 'utf8');
  const rel = relative(root, file).replace(/\\/g, '/');
  const urlPath = '/' + rel.replace(/index\.html$/, '');
  const normalizedPath = urlPath || '/';

  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1].trim();
  const desc = (() => {
    for (const t of html.match(/<meta\b[^>]*>/gi) || []) {
      if ((attr(t, 'name') || '').toLowerCase() === 'description') return attr(t, 'content') || '';
    }
    return '';
  })();
  const canonical = (() => {
    const m = html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i);
    return m ? attr(m[0], 'href') : null;
  })();
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => norm(m[1]));
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgsNoAlt = imgs.filter((t) => !attr(t, 'alt')).length;
  const hrefs = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);

  const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const types = [];
  let faqSchema = null;
  let ldErrors = 0;
  for (const b of ldBlocks) {
    try {
      const d = JSON.parse(b);
      types.push(d['@type']);
      if (d['@type'] === 'FAQPage') {
        faqSchema = (d.mainEntity || []).map((q) => ({ q: norm(q.name || ''), a: norm(q.acceptedAnswer?.text || '') }));
      }
    } catch {
      ldErrors++;
    }
  }

  const faqVisible = [...html.matchAll(/<details>([\s\S]*?)<\/details>/gi)].map((m) => {
    const inner = m[1];
    const q = norm((inner.match(/<summary>([\s\S]*?)<\/summary>/i) || [, ''])[1]);
    const a = norm(inner.replace(/<summary>[\s\S]*?<\/summary>/i, ''));
    return { q, a };
  });

  // Open Graph / Twitter 元数据
  const og = {};
  for (const t of html.match(/<meta\b[^>]*>/gi) || []) {
    const prop = (attr(t, 'property') || '').toLowerCase();
    const name = (attr(t, 'name') || '').toLowerCase();
    if (prop.startsWith('og:')) og[prop] = attr(t, 'content') || '';
    if (name === 'twitter:card') og['twitter:card'] = attr(t, 'content') || '';
  }

  return {
    file,
    normalizedPath,
    title,
    desc,
    canonical,
    h1s,
    imgsNoAlt,
    hrefs,
    ldBlocks,
    types,
    faqSchema,
    faqVisible,
    ldErrors,
    og,
    html,
  };
});

const problems = [];
const titleSeen = new Map();

for (const p of pages) {
  const label = p.normalizedPath;
  if (/^https?:\/\//.test(label)) continue; // 静态资源目录里不会有，保险起见

  if (p.title.length < 20 || p.title.length > 65) problems.push(`${label} title 长度 ${p.title.length}`);
  if (p.desc.length < 60 || p.desc.length > 165) problems.push(`${label} description 长度 ${p.desc.length}`);
  if (p.h1s.length !== 1) problems.push(`${label} h1 数量 ${p.h1s.length}`);
  if (p.normalizedPath !== '/404.html' && !p.canonical) problems.push(`${label} 缺少 canonical`);
  if (p.canonical && !/^https?:\/\//.test(p.canonical)) problems.push(`${label} canonical 不是绝对地址`);
  if (p.imgsNoAlt) problems.push(`${label} ${p.imgsNoAlt} 张图片缺 alt`);
  if (p.ldErrors) problems.push(`${label} ${p.ldErrors} 个 JSON-LD 语法错误`);

  // 占位符泄漏（新 HTML 未走 Vite 入口时会出现）
  if (p.html.includes('%SITE_URL%') || p.html.includes('%BUILD_DATE%')) {
    problems.push(`${label} 存在未替换的占位符`);
  }

  // 社交卡片元数据
  if (p.normalizedPath !== '/404.html') {
    for (const key of ['og:title', 'og:description', 'og:image', 'twitter:card']) {
      if (!p.og[key]) problems.push(`${label} 缺少 ${key}`);
    }
    const ogType = p.og['og:image:type'];
    const ogImage = p.og['og:image'];
    if (ogType && ogImage) {
      const ext = ogImage.split('?')[0].split('.').pop().toLowerCase();
      const expected = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : null;
      if (expected && ogType !== expected) {
        problems.push(`${label} og:image:type=${ogType} 但文件是 .${ext}`);
      }
    }
  }

  if (p.faqSchema) {
    const byQ = new Map(p.faqVisible.map((v) => [v.q, v.a]));
    const missing = p.faqSchema.filter((s) => !byQ.has(s.q)).map((s) => s.q);
    const extra = p.faqVisible.filter((v) => !p.faqSchema.some((s) => s.q === v.q)).map((v) => v.q);
    const mismatch = p.faqSchema.filter((s) => byQ.has(s.q) && byQ.get(s.q) !== s.a).map((s) => s.q);
    if (missing.length) problems.push(`${label} FAQ schema 有但页面没有: ${missing.join(' / ')}`);
    if (extra.length) problems.push(`${label} 页面有但 schema 没有: ${extra.join(' / ')}`);
    if (mismatch.length) problems.push(`${label} FAQ 答案文本不一致: ${mismatch.join(' / ')}`);
  }

  if (p.title) {
    const list = titleSeen.get(p.title) || [];
    list.push(p.normalizedPath);
    titleSeen.set(p.title, list);
  }
}

// 站内链接检查
const known = new Set(pages.map((p) => p.normalizedPath));
known.add('/');
const canonPath = (href) => {
  const path = href.split(/[?#]/)[0] || '/';
  if (path === '/' || /\.[a-z0-9]+$/i.test(path)) return path;
  return path.endsWith('/') ? path : `${path}/`;
};
for (const p of pages) {
  for (const href of p.hrefs) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const path = canonPath(href);
    if (/\.(js|css|svg|png|jpg|jpeg|webp|ico|txt|xml|ttf|woff2?)$/.test(path)) continue;
    if (!known.has(path)) problems.push(`${p.normalizedPath} 链接到不存在的页面: ${href}`);
  }
}

for (const [title, list] of titleSeen) {
  if (list.length > 1) problems.push(`重复 title「${title}」: ${list.join(', ')}`);
}

// 输出
const rows = pages
  .filter((p) => p.normalizedPath !== '/404.html')
  .map((p) => ({
    page: p.normalizedPath,
    title: p.title.length,
    desc: p.desc.length,
    h1: p.h1s.length,
    jsonld: p.types.join(','),
    faq: p.faqSchema ? `${p.faqSchema.length}/${p.faqVisible.length}` : 'n/a',
  }));

console.log(`页面数: ${rows.length}`);
for (const r of rows) {
  console.log(`  ${String(r.page).padEnd(38)} title=${String(r.title).padStart(2)} desc=${String(r.desc).padStart(3)} h1=${r.h1} faq=${r.faq}`);
}

if (problems.length) {
  console.log(`\n问题 (${problems.length}):`);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exit(1);
}
console.log('\n问题: 0');
