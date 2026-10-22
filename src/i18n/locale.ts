import type { Locale } from '../types';

/**
 * 没有任何线索时的默认语言。
 *
 * 站点面向海外用户，所以直接访问 /app/（地址上没有 ?lang=）时
 * 界面与示例简历都用英文。从中文落地页进来时链接会带上 ?lang=zh，
 * 仍然是中文，不受这里影响。
 */
export const DEFAULT_LOCALE: Locale = 'en-US';

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
 * 落地页会在指向编辑器的链接上带 ?lang=，所以从英文首页进来是英文，
 * 从 /zh/ 进来是中文。直接访问 /app/ 或从书签进入时没有该参数，
 * 一律回退到英文（默认语言），不再按浏览器语言猜测。
 * 已保存的简历不受影响 —— 它自带语言设置。
 */
export function resolveInitialLocale(): Locale {
  return localeFromSearch() ?? DEFAULT_LOCALE;
}
