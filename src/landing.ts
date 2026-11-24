import { SUPPORT_URL } from './config/support';

/**
 * 落地页入口：编辑器链接语言标记 + 页脚赞助入口。
 *
 * 故意**不**引入崩溃上报：Sentry SDK 约 39KB gzip，而落地页只做两个 DOM 操作，
 * 把 SDK 打进落地页会让首屏 JS 从约 2KB 涨到 42KB（实测），收益与成本完全不匹配。
 * 编辑器页面（src/main.ts）仍然同步初始化 telemetry，错误上报覆盖真正有交互的页面。
 */

/** 当前落地页的语言（由各页面的 <html lang> 决定） */
function pageLocale(): 'en' | 'zh' {
  return document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/**
 * 让编辑器的初始语言跟随用户所在的落地页。
 *
 * 做法是给所有指向 /app/ 的链接补上 ?lang=：从英文首页进去就是英文，从 /zh/ 进去就是中文。
 * 这样不依赖浏览器语言（中文浏览器看英文站也不会被强行切中文），也不需要额外存储。
 * 编辑器只在首次生成示例简历时使用该参数，已保存的简历保持自己的语言设置。
 */
function tagEditorLinks(): void {
  const locale = pageLocale();

  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = anchor.getAttribute('href');
    if (!href) continue;

    let url: URL;
    try {
      url = new URL(href, location.origin);
    } catch {
      continue;
    }

    if (url.origin !== location.origin) continue;
    if (url.pathname !== '/app/' && url.pathname !== '/app') continue;
    if (url.searchParams.has('lang')) continue;

    url.searchParams.set('lang', locale);
    anchor.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
  }
}

/**
 * 页脚赞助入口。只有构建时配置了 VITE_BMC_URL 才会插入，
 * 这样没配赞助的部署不会留下一条死链。
 */
function mountSupportLink(): void {
  if (!SUPPORT_URL) return;

  const container = document.querySelector('.site-footer .container');
  const spans = container ? Array.from(container.children).filter((el) => el.tagName === 'SPAN') : [];
  const host = spans[spans.length - 1];
  if (!host) return;

  const link = document.createElement('a');
  link.href = SUPPORT_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = document.documentElement.lang.startsWith('zh') ? '☕ 请我喝杯咖啡' : '☕ Buy me a coffee';

  host.append(' · ', link);
}

tagEditorLinks();
mountSupportLink();
