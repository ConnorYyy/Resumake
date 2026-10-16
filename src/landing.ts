import { initTelemetry } from './services/telemetry';
import { SUPPORT_URL } from './config/support';

/**
 * 落地页入口：只做崩溃上报，并在配置了赞助链接时补一个页脚入口。
 * 落地页没有 Vue 实例，因此不传 app；隐私配置与编辑器完全一致（见 services/telemetry.ts）。
 */
initTelemetry();

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

mountSupportLink();
