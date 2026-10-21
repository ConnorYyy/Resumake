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

/** 落地页链接上使用的查询参数名：/app/?lang=en */
export const LOCALE_QUERY_KEY = 'lang';

/** 把 ?lang= 的取值归一化为受支持的 Locale；不认识的值返回 null */
export function parseLocaleParam(value: string | null): Locale | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en-US';
  return null;
}

/** 从查询字符串读取语言参数；不传参数时读取当前地址 */
export function localeFromSearch(search?: string): Locale | null {
  const query = search ?? (typeof location === 'undefined' ? '' : location.search);
  return parseLocaleParam(new URLSearchParams(query).get(LOCALE_QUERY_KEY));
}

/**
 * 编辑器首次进入时使用的语言。
 *
 * 落地页会在指向编辑器的链接上带 ?lang=，所以从英文首页进来就是英文，
 * 从 /zh/ 进来就是中文。直接访问 /app/ 或从书签进入时没有该参数，
 * 再退回浏览器语言。已保存的简历不受影响 —— 它自带语言设置。
 */
export function resolveInitialLocale(): Locale {
  return localeFromSearch() ?? detectLocale();
}
