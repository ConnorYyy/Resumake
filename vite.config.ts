import { defineConfig, type Plugin } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { loadEnv } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import siteConfig from './site.config.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };

const SITE_URL = siteConfig.siteUrl.replace(/\/+$/, '');
const RELEASE = `resumake@${pkg.version}`;

/**
 * 站点地图清单。
 *
 * localized = true 的页面参与中英 hreflang 互指（首页与中文首页）。
 * 内容页各自独立，互不翻译，因此不加 alternate。
 *
 * updated 是这一页「内容真正改动」的日期，不是构建日期：
 * 每次都写今天会让 Google 判定 lastmod 不可信，从而忽略它。
 * 改动某个页面的正文后，记得同步改这里的日期。
 */
const SITEMAP_PAGES = [
  { loc: '/', priority: '1.0', localized: true, updated: '2026-10-21' },
  { loc: '/zh/', priority: '0.9', localized: true, updated: '2026-10-21' },
  { loc: '/app/', priority: '0.7', localized: false, updated: '2026-10-21' },
  { loc: '/private-resume-builder/', priority: '0.8', localized: false, updated: '2026-10-21' },
  { loc: '/resume-builder-no-sign-up/', priority: '0.8', localized: false, updated: '2026-10-21' },
  { loc: '/free-resume-builder-no-watermark/', priority: '0.8', localized: false, updated: '2026-10-21' },
  { loc: '/ats-friendly-resume-builder/', priority: '0.8', localized: false, updated: '2026-10-21' },
  { loc: '/templates/', priority: '0.7', localized: false, updated: '2026-10-21' },
  { loc: '/resume-builder-without-email/', priority: '0.7', localized: false, updated: '2026-10-21' },
  { loc: '/zh/jianli-shengchengqi/', priority: '0.7', localized: false, updated: '2026-10-21' },
];

function buildSitemap(): string {
  const entries = SITEMAP_PAGES.map((page) => {
    const alternates = page.localized
      ? `
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/" />
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${SITE_URL}/zh/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`
      : '';
    return `  <url>
    <loc>${SITE_URL}${page.loc}</loc>
    <lastmod>${page.updated}</lastmod>
    <priority>${page.priority}</priority>${alternates}
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`;
}

/** 替换 HTML 中的 %SITE_URL% / %BUILD_DATE%，并生成 sitemap.xml 与 robots.txt */
function seoPlugin(): Plugin {
  return {
    name: 'resumake-seo',
    transformIndexHtml(html) {
      return html
        .replace(/%SITE_URL%/g, SITE_URL)
        .replace(/%BUILD_DATE%/g, new Date().toISOString().slice(0, 10));
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap() });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 读取 .env / .env.local 等文件（含不带 VITE_ 前缀的构建期变量，不会进入前端产物）
  const env = loadEnv(mode, '.', '');
  // CI 上通常用系统环境变量提供 token，这里不引入 @types/node，保持类型干净
  const systemEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN || systemEnv.SENTRY_AUTH_TOKEN;
  const sentryOrg = env.SENTRY_ORG || 'connor-d3';
  const sentryProject = env.SENTRY_PROJECT || 'resumake-web';
  /** 有 token 才上传 source map，并在上报里带版本号；否则构建完全不依赖 Sentry */
  const withSentryUpload = Boolean(sentryAuthToken);

  return {
    define: {
      'import.meta.env.VITE_APP_RELEASE': JSON.stringify(RELEASE),
    },
    plugins: [
      vue(),
      seoPlugin(),
      ...(withSentryUpload
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              release: { name: RELEASE, inject: false, create: true },
              sourcemaps: {
                filesToDeleteAfterUpload: ['./dist/**/*.map'],
                // 去掉 sentry 里显示的 ../.. 前缀，让路径直接是 src/xxx
                rewriteSources: (source) => source.replace(/^(\.\.[/\\])+/, ''),
              },
              telemetry: false,
              // 上报失败不应让构建失败
              errorHandler: (err) => {
                console.warn(`[sentry] source map 上报未完成：${err.message}`);
              },
            }),
          ]
        : []),
    ],
    build: {
      chunkSizeWarningLimit: 4000,
      sourcemap: withSentryUpload ? 'hidden' : false,
      rolldownOptions: {
        input: {
          main: 'index.html',
          zh: 'zh/index.html',
          app: 'app/index.html',
          notFound: '404.html',
          privateResumeBuilder: 'private-resume-builder/index.html',
          noSignUp: 'resume-builder-no-sign-up/index.html',
          noWatermark: 'free-resume-builder-no-watermark/index.html',
          atsFriendly: 'ats-friendly-resume-builder/index.html',
          templates: 'templates/index.html',
          withoutEmail: 'resume-builder-without-email/index.html',
          zhGenerator: 'zh/jianli-shengchengqi/index.html',
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      css: { include: [/.+/] },
    },
  };
});
