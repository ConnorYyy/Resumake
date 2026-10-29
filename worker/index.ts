import { handleAiRewrite, handleAiStatus, type AiEnv } from './ai';

/**
 * Worker 入口。
 *
 * 站点本身是纯静态资源。这个脚本负责两件事：
 *
 * 1. 接收匿名的功能使用计数（POST /api/event/<事件名>）。
 *    事件名放在路径里，校验白名单后返回 204 —— 请求本身就会被 Cloudflare 的
 *    边缘统计记录，所以不需要数据库，数据也留在自己的账号内。
 *
 * 2. 转发 AI 文案优化（POST /api/ai/rewrite）。
 *    API Key 只存在于 Worker Secret，前端拿不到；实现见 worker/ai.ts。
 *
 * 其余请求全部回落给静态资源，行为与纯静态部署一致。
 */

const EVENT_PREFIX = '/api/event/';
const AI_PATH = '/api/ai/rewrite';
const AI_STATUS_PATH = '/api/ai/status';

/** 白名单事件名，避免接口被刷入垃圾数据 */
const ALLOWED_EVENTS = new Set(['editor_open', 'export']);

/**
 * 已合并的页面 → 保留页。
 * `resume-builder-without-email` 与 `resume-builder-no-sign-up` 是同一个搜索意图，
 * 两页各 600 词互相稀释，合并成一篇更长的页面，旧地址永久重定向。
 */
const REDIRECTS: Record<string, string> = {
  '/resume-builder-without-email/': '/resume-builder-no-sign-up/',
};

/**
 * 归一化路径以便匹配重定向表。
 * 小写 + 去掉末尾的点（某些爬虫会请求 `/x.`）+ 补尾斜杠，
 * 三种变体都落到同一个 key，避免漏掉 301 变成 404。
 */
function normalizePath(pathname: string): string {
  const trimmed = pathname.toLowerCase().replace(/\.+$/, '');
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export interface Env extends AiEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 合并后的旧地址：301 到保留页（保留查询串）
    const target = REDIRECTS[normalizePath(url.pathname)];
    if (target) {
      const to = new URL(target, url);
      to.search = url.search;
      return Response.redirect(to.toString(), 301);
    }

    if (url.pathname === AI_STATUS_PATH && request.method === 'GET') {
      return handleAiStatus(env);
    }

    if (request.method === 'POST' && url.pathname === AI_PATH) {
      return handleAiRewrite(request, env);
    }

    if (request.method === 'POST' && url.pathname.startsWith(EVENT_PREFIX)) {
      const name = url.pathname.slice(EVENT_PREFIX.length);
      // 白名单之外一律落到静态资源（即 404），不会被计入统计
      if (ALLOWED_EVENTS.has(name)) {
        return new Response(null, { status: 204 });
      }
    }

    // 其余请求全部交给静态资源，行为与之前「只有 assets」时完全一致
    return env.ASSETS.fetch(request);
  },
};
