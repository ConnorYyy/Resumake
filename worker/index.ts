/**
 * Worker 入口。
 *
 * 站点本身是纯静态资源。这个脚本只多做一件事：接收匿名的功能使用计数。
 *
 * 实现刻意做得很轻：前端把事件名放在路径里（POST /api/event/export），
 * Worker 校验白名单后返回 204 —— **请求本身就会被 Cloudflare 的边缘统计记录**，
 * 所以不需要数据库、不需要额外产品，数据也留在自己的账号内、不经过任何第三方。
 *
 * 计数内容只有事件名，不含 Cookie、不含身份标识、也不含任何简历内容。
 */

const PREFIX = '/api/event/';

/** 白名单事件名，避免接口被刷入垃圾数据 */
const ALLOWED_EVENTS = new Set(['editor_open', 'export']);

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname.startsWith(PREFIX)) {
      const name = url.pathname.slice(PREFIX.length);
      // 白名单之外一律落到静态资源（即 404），不会被计入统计
      if (ALLOWED_EVENTS.has(name)) {
        return new Response(null, { status: 204 });
      }
    }

    // 其余请求全部交给静态资源，行为与之前「只有 assets」时完全一致
    return env.ASSETS.fetch(request);
  },
};
