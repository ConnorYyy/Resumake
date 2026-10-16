import shellCss from './shell.css?raw';
import { escapeHtml } from './render';
import type { Locale, MarginPreset, PaperSize } from '../types';

export const PAPER: Record<PaperSize, { width: string; height: string; widthPx: number; heightPx: number; css: string }> = {
  A4: { width: '210mm', height: '297mm', widthPx: (210 * 96) / 25.4, heightPx: (297 * 96) / 25.4, css: 'A4' },
  Letter: { width: '8.5in', height: '11in', widthPx: 8.5 * 96, heightPx: 11 * 96, css: 'letter' },
};

export const MARGIN: Record<MarginPreset, string> = {
  narrow: '10mm',
  normal: '15mm',
  wide: '20mm',
};

/** 英文简历优先使用西文字体栈，避免中文字体把英文撑宽 */
const FONT_STACK: Record<Locale, string> = {
  'zh-CN':
    "'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Segoe UI', Arial, sans-serif",
  'en-US':
    "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, 'Noto Sans', 'Microsoft YaHei', sans-serif",
};

export interface DocumentOptions {
  bodyHtml: string;
  templateCss: string;
  customCss: string;
  paper: PaperSize;
  margin: MarginPreset;
  locale: Locale;
  title: string;
  themeColor: string;
  fontScale: number;
}

/** 生成预览与打印共用的完整 HTML 文档 */
export function buildDocument(opts: DocumentOptions): string {
  const paper = PAPER[opts.paper];
  const scale = Number.isFinite(opts.fontScale) && opts.fontScale > 0 ? opts.fontScale : 1;
  return `<!doctype html>
<html lang="${opts.locale}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(opts.title)}</title>
<style>${shellCss}</style>
<style>:root{--page-width:${paper.width};--page-height:${paper.height};--page-margin:${MARGIN[opts.margin]};--fs:${scale};--font-body:${FONT_STACK[opts.locale]};}
@page{size:${paper.css};margin:${MARGIN[opts.margin]};}</style>
<style>${opts.templateCss}</style>
<style>${opts.themeColor ? `:root{--accent:${opts.themeColor};}` : ''}</style>
<style>${opts.customCss}</style>
</head>
<body>
<main class="resume-page">
${opts.bodyHtml}
</main>
</body>
</html>`;
}
