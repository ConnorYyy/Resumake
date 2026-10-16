import type { ResumeDoc } from '../types';
import { translate } from '../i18n/translate';

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '');
  return cleaned || 'resume';
}

/** 形如「张明远 - 简历.html」「Alex Morgan - Resume.html」 */
function fileName(doc: ResumeDoc, extension: string): string {
  const label = translate(doc.meta.locale, 'doc.titleUntitled');
  return `${safeName(doc.profile.name)} - ${label}.${extension}`;
}

export function exportJson(doc: ResumeDoc) {
  const content = JSON.stringify(doc, null, 2);
  downloadBlob(fileName(doc, 'json'), content, 'application/json');
}

export function exportHtml(doc: ResumeDoc, srcdoc: string) {
  downloadBlob(fileName(doc, 'html'), srcdoc, 'text/html');
}

/** 解析失败时抛出 SyntaxError，由调用方按当前语言提示 */
export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}
