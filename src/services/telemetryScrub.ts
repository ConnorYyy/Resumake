import type { ErrorEvent } from '@sentry/vue';

/**
 * 崩溃上报的“清洗层”：纯函数，方便单测。
 *
 * 本产品承诺简历内容不出浏览器，因此上报前必须把所有可能夹带正文的字段抹掉。
 * 这里只依赖类型（`import type`），运行时不引入 Sentry SDK。
 */

const MAX_MESSAGE = 160;
const MAX_EXCEPTION_VALUE = 240;

/**
 * 把一段可能夹带用户内容的文本压成安全片段：
 * 图片 data URL、邮箱、网址、超长 token 一律替换为占位符，引号内的内容清空，最后截断。
 */
export function sanitizeText(input: unknown, max: number = MAX_MESSAGE): string {
  if (typeof input !== 'string' || input.length === 0) return '';
  let text = input;
  text = text.replace(/data:[^\s"']+/gi, '[data-url]');
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
  text = text.replace(/https?:\/\/[^\s"')]+/gi, '[url]');
  text = text.replace(/[A-Za-z0-9+/=_-]{32,}/g, '[token]');
  text = text.replace(/"[^"]{3,}"/g, '"…"');
  text = text.replace(/'[^']{3,}'/g, "'…'");
  text = text.replace(/“[^”]{3,}”/g, '“…”');
  text = text.replace(/[\r\n\t]+/g, ' ');
  text = text.replace(/\s{2,}/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 只保留网址的路径部分，去掉查询串与 hash（可能含用户输入） */
function sanitizeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url) return undefined;
  const base = url.split('#')[0].split('?')[0];
  return base.length > 200 ? base.slice(0, 200) : base;
}

/**
 * 发送前的最后一道闸门：删除用户信息、面包屑、自定义附加数据，
 * 清洗错误文本，并丢掉栈帧里的局部变量与源码上下文。
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  delete event.threads;

  if (event.message) event.message = sanitizeText(event.message) || 'error';
  if (event.logentry?.message) event.logentry.message = sanitizeText(event.logentry.message) || 'error';

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = sanitizeText(exception.value, MAX_EXCEPTION_VALUE) || 'error';
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars;
      delete frame.context_line;
      delete frame.pre_context;
      delete frame.post_context;
    }
  }

  const url = sanitizeUrl(event.request?.url);
  event.request = url ? { url } : {};

  if (event.contexts) {
    // Vue 集成的 contexts.vue 可能带组件 props；设备信息对排查无帮助
    delete event.contexts.vue;
    delete event.contexts.device;
  }

  return event;
}
