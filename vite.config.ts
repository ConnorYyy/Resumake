import { defineConfig, type Plugin } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { loadEnv } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import siteConfig from './site.config.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };
import { handleAiRewrite } from './worker/ai.ts';

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
  { loc: '/', priority: '1.0', localized: true, updated: '2026-10-28' },
  { loc: '/zh/', priority: '0.9', localized: true, updated: '2026-10-28' },
  { loc: '/app/', priority: '0.7', localized: false, updated: '2026-10-28' },
  { loc: '/private-resume-builder/', priority: '0.8', localized: false, updated: '2026-10-28' },
  { loc: '/resume-builder-no-sign-up/', priority: '0.8', localized: false, updated: '2026-10-28' },
  { loc: '/free-resume-builder-no-watermark/', priority: '0.8', localized: false, updated: '2026-10-28' },
  { loc: '/ats-friendly-resume-builder/', priority: '0.8', localized: false, updated: '2026-10-28' },
  { loc: '/templates/', priority: '0.7', localized: false, updated: '2026-10-28' },
  { loc: '/zh/jianli-shengchengqi/', priority: '0.7', localized: false, updated: '2026-10-28' },
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

/** 替换 HTML 中的 %SITE_URL% / %BUILD_DATE%，并生成 sitemap.xml 与 robots.txt */function seoPlugin(): Plugin {
  return {
    name: 'resumake-seo',
    transformIndexHtml(html, ctx) {
      let out = html
        .replace(/%SITE_URL%/g, SITE_URL)
        .replace(/%BUILD_DATE%/g, new Date().toISOString().slice(0, 10));

      // 开发服务器上 Cloudflare Web Analytics 会被 CORS 拦截，产生无意义的报错。
      // 生产构建保持原样。
      if (ctx.server) {
        out = out.replace(/<script[^>]*static\.cloudflareinsights\.com[\s\S]*?<\/script>/g, '');
      }

      return out;
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

/**
 * 本地开发时用 Vite 中间件代替 Worker 处理 /api/ai/rewrite。
 * 与生产共用 worker/ai.ts，所以本地验证的就是线上那套逻辑。
 * Key 从 .env.local 读取（不带 VITE_ 前缀，不会进入前端产物）。
 *
 * 项目没有装 @types/node，这里用局部接口描述真正用到的那几个成员。
 */
interface DevRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  setEncoding(encoding: string): void;
  on(event: 'data', listener: (chunk: string) => void): void;
  on(event: 'end', listener: () => void): void;
}

interface DevResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function aiDevPlugin(apiKey: string | undefined, model: string | undefined): Plugin {
  return {
    name: 'resumake-ai-dev',
    apply: 'serve',
    configureServer(server) {
      // 本地也提供状态探测，行为与线上一致
      server.middlewares.use('/api/ai/status', (rawReq, rawRes) => {
        const req = rawReq as unknown as DevRequest;
        const res = rawRes as unknown as DevResponse;

        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        res.statusCode = 200;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(JSON.stringify({ enabled: Boolean(apiKey) }));
      });

      server.middlewares.use('/api/ai/rewrite', (rawReq, rawRes) => {
        const req = rawReq as unknown as DevRequest;
        const res = rawRes as unknown as DevResponse;

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => {
          body += chunk;
        });
        req.on('end', () => {
          void (async () => {
            const rawType = req.headers['content-type'];
            const contentType = Array.isArray(rawType) ? rawType[0] : (rawType ?? 'application/json');

            const request = new Request('http://localhost/api/ai/rewrite', {
              method: 'POST',
              headers: {
                'content-type': contentType,
                'cf-connecting-ip': '127.0.0.1',
              },
              body,
            });

            try {
              const response = await handleAiRewrite(request, {
                OPENCODE_GO_API_KEY: apiKey,
                AI_MODEL: model,
              });
              res.statusCode = response.status;
              response.headers.forEach((value, key) => res.setHeader(key, value));
              res.end(await response.text());
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'dev_proxy_failed', detail: String(err).slice(0, 160) }));
            }
          })();
        });
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
      aiDevPlugin(env.OPENCODE_GO_API_KEY, env.AI_MODEL),
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
          zhGenerator: 'zh/jianli-shengchengqi/index.html',
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
      css: { include: [/.+/] },
    },
  };
});
