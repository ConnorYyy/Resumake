import type { Locale } from '../types';
import { enUS, zhCN, type Messages } from './messages';

const dictionaries: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

/** 按语言取文案，支持 {name} 形式的参数替换；缺失时回退为 key */
export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const text = dictionaries[locale][key] ?? dictionaries['zh-CN'][key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
