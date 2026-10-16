import { defineConfig, type Plugin } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { loadEnv } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import siteConfig from './site.config.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };

const SITE_URL = siteConfig.siteUrl.replace(/\/+$/, '');
const RELEASE = `resumake@${pkg.version}`;

function buildSitemap(): string {
  const today = new Date().toISOString().slice(0, 10);
  const pages = [
    { loc: `${SITE_URL}/`, priority: '1.0', localized: true },
    { loc: `${SITE_URL}/zh/`, priority: '0.9', localized: true },
    { loc: `${SITE_URL}/app/`, priority: '0.8', localized: false },
  ];
  const entries = pages
    .map((page) => {
      const alternates = page.localized
        ? `
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/" />
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${SITE_URL}/zh/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`
        : '';
      return `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${page.priority}</priority>${alternates}
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`;
}

/** 替换 HTML 中的 %SITE_URL%，并生成 sitemap.xml 与 robots.txt */
function seoPlugin(): Plugin {
  return {
    name: 'resumake-seo',
    transformIndexHtml(html) {
      return html.replace(/%SITE_URL%/g, SITE_URL);
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
