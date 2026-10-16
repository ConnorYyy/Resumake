import type { DateFormat, Locale } from '../types';

/** 每种语言下可选的日期格式，以及默认值 */
export const DATE_FORMATS: Record<Locale, DateFormat[]> = {
  'zh-CN': ['ym', 'cn'],
  'en-US': ['ym', 'my', 'mmy'],
};

export function defaultDateFormat(locale: Locale): DateFormat {
  return DATE_FORMATS[locale][0];
}

export function isDateFormatFor(value: unknown, locale: Locale): value is DateFormat {
  return typeof value === 'string' && (DATE_FORMATS[locale] as string[]).includes(value);
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_MONTH_INDEX: Record<string, number> = Object.fromEntries(EN_MONTHS.map((m, i) => [m.toLowerCase(), i + 1]));

export interface DateParts {
  year: string;
  /** 两位月份，空字符串表示只填了年份 */
  month: string;
}

/** 解析内部存储的日期值：YYYY、YYYY-MM（也兼容导入时可能出现的 YYYY-MM-DD） */
export function parseDateValue(value: string): DateParts | null {
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-\d{1,2})?$/.exec(value.trim());
  if (!match) return null;
  const year = match[1];
  if (!match[2]) return { year, month: '' };
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month: String(month).padStart(2, '0') };
}

/** 把 YYYY / YYYY-MM 按指定格式输出；无法解析的旧文本原样返回 */
export function formatDate(value: string, locale: Locale, format: DateFormat): string {
  const parts = parseDateValue(value);
  if (!parts) return value.trim();
  const { year, month } = parts;
  if (!month) return year;
  const n = Number(month);
  switch (format) {
    case 'my':
      return `${month}.${year}`;
    case 'mmy':
      return `${EN_MONTHS[n - 1]} ${year}`;
    case 'cn':
      return `${year}年${n}月`;
    default:
      return `${year}.${month}`;
  }
}

export function presentLabel(locale: Locale): string {
  return locale === 'zh-CN' ? '至今' : 'Present';
}

/** 把「开始 / 结束 / 至今」拼成一行时间文本 */
export function formatRange(
  start: string,
  end: string,
  present: boolean,
  locale: Locale,
  format: DateFormat,
): string {
  const from = start.trim() ? formatDate(start, locale, format) : '';
  const to = present ? presentLabel(locale) : end.trim() ? formatDate(end, locale, format) : '';
  if (from && to) return `${from} - ${to}`;
  return from || to;
}

function parseSingleDate(token: string): string | null {
  const text = token.trim();
  if (/^(至今|现在|present|now|current|today)$/i.test(text)) return null;
  // 2020、2020.07、2020/07、2020-07、2020年7月
  const cjk = /^(\d{4})\s*年\s*(\d{1,2})\s*月?$/.exec(text);
  if (cjk) return `${cjk[1]}-${String(Number(cjk[2])).padStart(2, '0')}`;
  const numeric = /^(\d{4})(?:[./-](\d{1,2}))?(?:[./-]\d{1,2})?$/.exec(text);
  if (numeric) {
    if (!numeric[2]) return numeric[1];
    const month = Number(numeric[2]);
    return month >= 1 && month <= 12 ? `${numeric[1]}-${String(month).padStart(2, '0')}` : null;
  }
  // Jul 2020 / July 2020
  const named = /^([A-Za-z]{3,9})\.?\s+(\d{4})$/.exec(text);
  if (named) {
    const month = EN_MONTH_INDEX[named[1].slice(0, 3).toLowerCase()];
    if (month) return `${named[2]}-${String(month).padStart(2, '0')}`;
  }
  // 2020 Jul
  const namedRev = /^(\d{4})\s+([A-Za-z]{3,9})\.?$/.exec(text);
  if (namedRev) {
    const month = EN_MONTH_INDEX[namedRev[2].slice(0, 3).toLowerCase()];
    if (month) return `${namedRev[1]}-${String(month).padStart(2, '0')}`;
  }
  return null;
}

export interface ParsedPeriod {
  start: string;
  end: string;
  present: boolean;
  /** 是否至少解析出一个日期，false 时说明这是无法结构化的旧文本 */
  parsed: boolean;
}

const PRESENT_TEST_RE = /至今|现在|\b(?:present|now|current|today)\b/i;
const PRESENT_STRIP_RE = /至今|现在|\b(?:present|now|current|today)\b/gi;

/**
 * 从文本中按出现顺序挑出日期。用「扫描 token」而不是「按分隔符切开」，
 * 因为连字符是日期的一部分（2020-07），而「至」也是「至今」的一部分。
 */
const DATE_TOKEN_RE =
  /\d{4}\s*年\s*\d{1,2}\s*月?|[A-Za-z]{3,9}\.?\s+\d{4}|\d{4}\s*[./]\s*\d{1,2}(?!\d)|\d{4}-\d{1,2}(?!\d)|\d{4}/g;

function extractDates(text: string): string[] {
  const dates: string[] = [];
  for (const match of text.matchAll(DATE_TOKEN_RE)) {
    const parsed = parseSingleDate(match[0]);
    if (parsed) dates.push(parsed);
  }
  return dates;
}

/** 尽力把旧版自由文本时间（如 "2020.07 - 至今"）解析为结构化日期 */
export function parsePeriodText(text: string): ParsedPeriod {
  const raw = text.trim();
  if (!raw) return { start: '', end: '', present: false, parsed: false };

  const present = PRESENT_TEST_RE.test(raw);
  const dates = extractDates(raw.replace(PRESENT_STRIP_RE, ' '));

  if (dates.length === 0) return { start: '', end: '', present, parsed: present };

  return {
    start: dates[0],
    end: present ? '' : (dates[1] ?? ''),
    present,
    parsed: true,
  };
}
