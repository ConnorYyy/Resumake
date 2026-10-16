import type { Locale } from '../types';

/**
 * 首次访问（本地还没有保存内容）时按浏览器语言选择界面语言。
 * 中文浏览器用中文，其余一律用英文 —— 面向海外用户，英文是更安全的默认值。
 */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en-US';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((lang) => /^zh\b/i.test(lang ?? '')) ? 'zh-CN' : 'en-US';
}
