/**
 * Worker 入口。
 *
 * 站点本身是纯静态资源，这个脚本只多承担一件事：接收匿名的功能使用计数。
 *
 * 计数内容**只有事件名**（例如 "export"），不含 Cookie、不含任何身份标识、
 * 也不含任何简历内容，写入 Cloudflare Analytics Engine 供站主自己查询。
 * 数据留在站主自己的 Cloudflare 账号内，不经过任何第三方。
 */

/** 白名单事件名，避免接口被刷入垃圾数据 */
const ALLOWED_EVENTS = new Set(['editor_open', 'export']);

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  EVENTS: {
    writeDataPoint(point: { blobs?: string[]; indexes?: string[]; doubles?: number[] }): void;
  };
}

async function countEvent(request: Request, env: Env): Promise<Response> {
  try {
    const { name } = (await request.json()) as { name?: unknown };
    if (typeof name === 'string' && ALLOWED_EVENTS.has(name)) {
      // indexes 用于按事件名快速过滤；blobs 存事件名本体
      env.EVENTS.writeDataPoint({ blobs: [name], indexes: [name], doubles: [1] });
    }
  } catch {
    /* 统计失败不能影响任何用户操作，静默处理 */
  }
  // 一律返回 204：调用方不需要知道结果，也不暴露白名单细节
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/event' && request.method === 'POST') {
      return countEvent(request, env);
    }

    // 其余请求全部交给静态资源，行为与之前「只有 assets」时完全一致
    return env.ASSETS.fetch(request);
  },
};
