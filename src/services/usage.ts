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

/**
 * 自动化环境识别。
 *
 * 站点上线后一直有云厂商的无头浏览器（Puppeteer 类）每天定时打开首页和编辑器，
 * 它们会执行 JS，因此也会触发 editor_open —— 让「编辑器打开」这个数字失真。
 * navigator.webdriver 是浏览器对自动化驱动的标准标记，真人浏览器不会为 true，
 * 所以用它把这类流量排除掉（同时也排除 UA 里带 HeadlessChrome 的客户端）。
 */
function isAutomatedClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (navigator.webdriver) return true;
  return /HeadlessChrome|PhantomJS|Puppeteer|Playwright/i.test(navigator.userAgent);
}

export function trackUsage(event: UsageEvent): void {
  // 本地开发时没有这个接口，直接跳过，避免控制台出现无意义的 404
  if (!import.meta.env.PROD) return;

  // 无头浏览器 / 自动化脚本的"使用"不是真人使用，不计入
  if (isAutomatedClient()) return;

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
