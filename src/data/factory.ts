import type { ListItem, ListKey, Locale, ResumeDoc } from '../types';
import { DEFAULT_SECTION_ORDER, LIST_SCHEMA } from './schema';
import { defaultDateFormat } from '../engine/date';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createItem(list: ListKey): ListItem {
  return { id: uid(), ...LIST_SCHEMA[list].defaults };
}

export function createEmptyDoc(locale: Locale = 'zh-CN', templateId = 'classic'): ResumeDoc {
  return {
    version: '1.0',
    meta: {
      templateId,
      locale,
      // 美国等地区习惯用 Letter，中文环境默认 A4
      paperSize: locale === 'en-US' ? 'Letter' : 'A4',
      margin: 'normal',
      customCss: '',
      customHtml: null,
      themeColor: '',
      dateFormat: defaultDateFormat(locale),
      sectionTitles: {},
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      fontScale: 1,
      updatedAt: new Date().toISOString(),
    },
    profile: {
      name: '',
      title: '',
      phone: '',
      email: '',
      website: '',
      linkedin: '',
      location: '',
      workAuth: '',
      summary: '',
    },
    education: [],
    experience: [],
    projects: [],
    skills: [],
    certificates: [],
    customSections: [],
  };
}
