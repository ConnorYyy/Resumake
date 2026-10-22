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

export interface Env extends AiEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
