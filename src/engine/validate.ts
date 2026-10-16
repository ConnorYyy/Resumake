import { DEFAULT_SECTION_ORDER, LIST_SCHEMA, PROFILE_FIELDS, isSectionKey, isSectionTitleKey, snapFontScale } from '../data/schema';
import { uid } from '../data/factory';
import { defaultDateFormat, isDateFormatFor, parsePeriodText } from './date';
import { getTemplate } from '../templates';
import { AVATAR_PATTERN } from '../services/image';
import { translate } from '../i18n/translate';
import type {
  DateFormat,
  ListItem,
  ListKey,
  Locale,
  MarginPreset,
  PaperSize,
  PhotoAlign,
  ResumeDoc,
  SectionKey,
  SectionTitles,
} from '../types';

export type ValidateResult = { ok: true; doc: ResumeDoc } | { ok: false; error: string };

const LOCALES: Locale[] = ['zh-CN', 'en-US'];
const PAPERS: PaperSize[] = ['A4', 'Letter'];
const MARGINS: MarginPreset[] = ['narrow', 'normal', 'wide'];
const PHOTO_ALIGNS: PhotoAlign[] = ['left', 'center', 'right'];
const THEME_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const RANGE_LISTS: ListKey[] = ['education', 'experience', 'projects'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 允许 "available on request" 之类的文字说明，只排除明显过短的内容
const PHONE_RE = /^[\d\s()+.\-a-zA-Z/]{5,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

export function isValidUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v);
}

class ValidationError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function normalizeList(raw: unknown, list: ListKey, locale: Locale): ListItem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new ValidationError(translate(locale, 'validate.notArray', { list }));
  }
  const keys = Object.keys(LIST_SCHEMA[list].defaults);
  return raw.map((entry) => {
    if (!isObject(entry)) {
      throw new ValidationError(translate(locale, 'validate.itemNotObject', { list }));
    }
    const normalized: Record<string, string> = {};
    for (const key of keys) normalized[key] = asString(entry[key]);
    const item: ListItem = { id: typeof entry.id === 'string' && entry.id ? entry.id : uid(), ...normalized };
    migrateItem(item, list);
    return item;
  });
}

/** 把旧版本的自由文本时间迁移为结构化日期，无法解析时保留原文 */
export function migrateItem(item: ListItem, list: ListKey): void {
  if (RANGE_LISTS.includes(list)) {
    const hasStructured = Boolean(item.periodStart || item.periodEnd || item.present);
    if (!hasStructured && item.period) {
      const parsed = parsePeriodText(item.period);
      if (parsed.parsed) {
        item.periodStart = parsed.start;
        item.periodEnd = parsed.end;
        item.present = parsed.present ? '1' : '';
        item.period = '';
      }
    }
  }
  if (list === 'certificates' && item.date) {
    const parsed = parsePeriodText(item.date);
    if (parsed.parsed && parsed.start) item.date = parsed.start;
  }
}

function normalizeSectionTitles(raw: unknown): SectionTitles {
  const result: SectionTitles = {};
  if (!isObject(raw)) return result;
  for (const locale of LOCALES) {
    const group = raw[locale];
    if (!isObject(group)) continue;
    const titles: Record<string, string> = {};
    for (const [key, value] of Object.entries(group)) {
      if (!isSectionTitleKey(key)) continue;
      const text = asString(value).trim();
      if (text) titles[key] = text;
    }
    if (Object.keys(titles).length) result[locale] = titles;
  }
  return result;
}

function normalizeSectionOrder(raw: unknown): SectionKey[] {
  const order: SectionKey[] = [];
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (isSectionKey(value) && !order.includes(value)) order.push(value);
    }
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!order.includes(key)) order.push(key);
  }
  return order;
}

function normalizeFontScale(raw: unknown): number {
  const value = typeof raw === 'number' ? raw : Number.parseFloat(asString(raw));
  if (!Number.isFinite(value)) return 1;
  return snapFontScale(value);
}

/** 校验并规范化导入的 JSON，失败时返回当前语言的错误信息 */
export function validateResumeFile(input: unknown, locale: Locale = 'zh-CN'): ValidateResult {
  try {
    if (!isObject(input)) throw new ValidationError(translate(locale, 'validate.notObject'));
    if (input.version !== '1.0') throw new ValidationError(translate(locale, 'validate.version'));
    if (!isObject(input.meta)) throw new ValidationError(translate(locale, 'validate.noMeta'));
    if (!isObject(input.profile)) throw new ValidationError(translate(locale, 'validate.noProfile'));

    const meta = input.meta;
    const templateId = asString(meta.templateId) || 'classic';
    if (!getTemplate(templateId)) {
      throw new ValidationError(translate(locale, 'validate.unknownTemplate', { id: templateId }));
    }
    const docLocale = LOCALES.includes(meta.locale as Locale) ? (meta.locale as Locale) : 'zh-CN';
    const paperSize = PAPERS.includes(meta.paperSize as PaperSize) ? (meta.paperSize as PaperSize) : 'A4';
    const margin = MARGINS.includes(meta.margin as MarginPreset) ? (meta.margin as MarginPreset) : 'normal';
    const customHtml = typeof meta.customHtml === 'string' ? meta.customHtml : null;
    const themeColor =
      typeof meta.themeColor === 'string' && THEME_COLOR_PATTERN.test(meta.themeColor) ? meta.themeColor : '';
    const dateFormat: DateFormat = isDateFormatFor(meta.dateFormat, docLocale)
      ? (meta.dateFormat as DateFormat)
      : defaultDateFormat(docLocale);

    const rawProfile = input.profile as Record<string, unknown>;
    const profile: ResumeDoc['profile'] = Object.fromEntries(
      PROFILE_FIELDS.map(({ key }) => [key, asString(rawProfile[key])]),
    ) as ResumeDoc['profile'];
    const avatar = asString(rawProfile.avatar);
    if (avatar && AVATAR_PATTERN.test(avatar)) profile.avatar = avatar;
    const align = rawProfile.avatarAlign;
    if (typeof align === 'string' && PHOTO_ALIGNS.includes(align as PhotoAlign)) {
      profile.avatarAlign = align as PhotoAlign;
    }

    const doc: ResumeDoc = {
      version: '1.0',
      meta: {
        templateId,
        locale: docLocale,
        paperSize,
        margin,
        customCss: asString(meta.customCss),
        customHtml,
        themeColor,
        dateFormat,
        sectionTitles: normalizeSectionTitles(meta.sectionTitles),
        sectionOrder: normalizeSectionOrder(meta.sectionOrder),
        fontScale: normalizeFontScale(meta.fontScale),
        updatedAt: new Date().toISOString(),
      },
      profile,
      education: normalizeList(input.education, 'education', locale),
      experience: normalizeList(input.experience, 'experience', locale),
      projects: normalizeList(input.projects, 'projects', locale),
      skills: normalizeList(input.skills, 'skills', locale),
      certificates: normalizeList(input.certificates, 'certificates', locale),
      customSections: normalizeList(input.customSections, 'customSections', locale),
    };
    return { ok: true, doc };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, error: err.message };
    return { ok: false, error: translate(locale, 'error.unknown') };
  }
}
