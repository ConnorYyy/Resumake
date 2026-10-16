import * as Sentry from '@sentry/vue';
import type { App } from 'vue';
import { scrubEvent, sanitizeText } from './telemetryScrub';

/**
 * 崩溃上报（Sentry）。
 *
 * 产品承诺“简历内容不出浏览器”，所以这里只上报**程序异常**，并做四层保护：
 * 1. 只有正式构建才发送（本地开发默认不发，可用 `VITE_SENTRY_DEV=1` 临时打开）；
 * 2. 关闭全部可选采集项：用户信息、Cookie、请求头/请求体、URL 查询参数、栈帧局部变量、源码上下文；
 * 3. 不记录面包屑，且 Vue 集成不附加组件 props（输入框内容、控制台日志都可能带正文）；
 * 4. 发送前再经 `scrubEvent` 清洗（见 telemetryScrub.ts）。
 *
 * 约定：任何地方都不得把简历数据（doc / profile / 表单字段）传给 captureException。
 */

const DSN = import.meta.env.VITE_SENTRY_DSN?.trim();
const RELEASE = import.meta.env.VITE_APP_RELEASE || 'dev';
const FORCE_IN_DEV = import.meta.env.VITE_SENTRY_DEV === '1';

/** 当前构建是否会发送上报（供调试与测试断言用） */
export const telemetryEnabled = Boolean(DSN) && (Boolean(import.meta.env.PROD) || FORCE_IN_DEV);

/** 上报分类白名单：只允许这些固定字符串，避免把用户内容当标签发出去 */
export type IssueArea = 'storage-read' | 'storage-write';

/**
 * 初始化上报。传入 `app` 表示编辑器（启用 Vue 集成），不传表示落地页等静态页面。
 * 两种场景共用同一套隐私配置。
 */
export function initTelemetry(app?: App): void {
  if (!telemetryEnabled) return;

  Sentry.init({
    // 只有编辑器才有 Vue 实例，落地页不额外引入 Vue 集成
    ...(app ? { app } : {}),
    dsn: DSN,
    release: RELEASE,
    environment: import.meta.env.MODE,
    // Vue 集成：不把组件 props 附到事件上
    attachProps: false,
    maxBreadcrumbs: 0,
    // 隐私：userInfo: false 让 SDK 不采集用户/IP 等默认信息（v11 用 dataCollection 取代了 sendDefaultPii）
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    },
    integrations: (defaults) =>
      defaults.filter(
        // Breadcrumbs：输入框内容、控制台日志可能夹带正文
        // BrowserSession：属于使用统计（release health），本产品只上报异常
        (integration) => integration.name !== 'Breadcrumbs' && integration.name !== 'BrowserSession',
      ),
    beforeBreadcrumb: () => null,
    beforeSend: (event) => scrubEvent(event),
    ignoreErrors: [
      // 浏览器/环境噪音，不是程序缺陷
      /ResizeObserver loop/,
      'Script error.',
      'Non-Error promise rejection captured with value: undefined',
      'AbortError',
      /^Load failed$/,
      /^Failed to fetch$/,
      /^NetworkError/,
      /ChunkLoadError/,
      /Importing a module script failed/,
      /The operation is insecure/,
    ],
  });
}

/** 主动上报一个可复现的失败点（分类只能是白名单内的固定字符串） */
export function reportIssue(area: IssueArea, error: unknown): void {
  if (!telemetryEnabled) return;
  const err = error instanceof Error ? error : new Error(sanitizeText(error) || 'unknown error');
  Sentry.withScope((scope) => {
    scope.setTag('area', area);
    Sentry.captureException(err);
  });
}
