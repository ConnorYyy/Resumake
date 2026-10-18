/**
 * 匿名的功能使用计数。
 *
 * 只上报一个事件名（例如 "export"），**不包含**任何简历内容、表单字段、照片、
 * Cookie 或用户标识。实现上把事件名放在请求路径里发给自己的 Worker
 * （见 worker/index.ts），由 Cloudflare 的边缘统计记录，数据留在站主自己的账号内。
 *
 * 统计永远不能影响用户操作，因此这里全部静默处理：
 * 失败、被拦截、离线，都不抛错也不提示。
 */

const ENDPOINT = '/api/event/';

export type UsageEvent = 'editor_open' | 'export';

export function trackUsage(event: UsageEvent): void {
  // 本地开发时没有这个接口，直接跳过，避免控制台出现无意义的 404
  if (!import.meta.env.PROD) return;

  try {
    const url = ENDPOINT + event;

    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url)) {
      // sendBeacon 在页面卸载时也能送达，且不会阻塞主线程
      return;
    }

    void fetch(url, { method: 'POST', keepalive: true }).catch(() => undefined);
  } catch {
    /* 统计失败不影响使用 */
  }
}
