import type { ListItem, Locale, ResumeDoc } from '../types';
import { escapeHtml } from './render';
import { formatDate, formatRange } from './date';

export interface Labels {
  summary: string;
  education: string;
  experience: string;
  projects: string;
  skills: string;
  certificates: string;
  contact: string;
  /** 技能分类与技能列表之间的分隔符，需跟随语言 */
  skillSep: string;
}

export const LABELS: Record<Locale, Labels> = {
  'zh-CN': {
    summary: '个人简介',
    education: '教育经历',
    experience: '工作经历',
    projects: '项目经历',
    skills: '专业技能',
    certificates: '证书奖项',
    contact: '联系方式',
    skillSep: '：',
  },
  'en-US': {
    summary: 'Summary',
    education: 'Education',
    experience: 'Experience',
    projects: 'Projects',
    skills: 'Skills',
    certificates: 'Certificates & Awards',
    contact: 'Contact',
    skillSep: ': ',
  },
};

/** 行内格式：**加粗**，其余内容转义 */
export function formatInline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-•·*]\s+/, ''))
    .filter((line) => line.length > 0);
}

/** 每行一条转为无序列表 */
export function toBulletList(text: string): string {
  const items = lines(text);
  if (items.length === 0) return '';
  return `<ul>${items.map((item) => `<li>${formatInline(item)}</li>`).join('')}</ul>`;
}

/** 段落文本，换行保留为 <br> */
export function toParagraph(text: string): string {
  const items = lines(text);
  return items.map(formatInline).join('<br>');
}

export function toHref(url: string): string {
  const value = url.trim();
  if (!value) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `https://${value}`;
}

/** 只有邮箱格式正确时才生成 mailto，避免导出后出现打不开的链接 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 整条内容都为空时不在简历中显示（表单里仍保留，便于继续填写） */
export function isBlankItem(item: ListItem): boolean {
  return Object.entries(item).every(([key, value]) => key === 'id' || !String(value ?? '').trim());
}

function mapItems(list: ListItem[], build: (item: ListItem) => Record<string, unknown>) {
  return list.filter((item) => !isBlankItem(item)).map(build);
}

function buildContacts(doc: ResumeDoc, sep: string): string {
  const { profile } = doc;
  const parts: string[] = [];
  if (profile.phone.trim()) parts.push(`<span>${escapeHtml(profile.phone.trim())}</span>`);
  if (profile.email.trim() && EMAIL_RE.test(profile.email.trim())) {
    parts.push(`<a href="mailto:${escapeHtml(profile.email.trim())}">${escapeHtml(profile.email.trim())}</a>`);
  }
  const linkedin = profile.linkedin.trim();
  if (linkedin) parts.push(`<a href="${escapeHtml(toHref(linkedin))}">${escapeHtml(linkedin)}</a>`);
  const website = profile.website.trim();
  if (website) parts.push(`<a href="${escapeHtml(toHref(website))}">${escapeHtml(website)}</a>`);
  if (profile.location.trim()) parts.push(`<span>${escapeHtml(profile.location.trim())}</span>`);
  const sepHtml = `<span class="sep">${escapeHtml(sep)}</span>`;
  return parts.join(sepHtml);
}

/** 将简历数据转换为模板可直接使用的上下文 */
export function prepareContext(doc: ResumeDoc, contactSep = ' | '): Record<string, unknown> {
  const { profile, meta } = doc;
  const overrides = meta.sectionTitles?.[meta.locale] ?? {};
  const labels: Labels = { ...LABELS[meta.locale], ...overrides };
  const format = meta.dateFormat;

  const range = (item: ListItem) => {
    const structured =
      item.periodStart || item.periodEnd || item.present
        ? formatRange(item.periodStart ?? '', item.periodEnd ?? '', item.present === '1', meta.locale, format)
        : '';
    return structured || item.period || '';
  };

  const education = mapItems(doc.education, (item) => ({
    ...item,
    period: range(item),
    descriptionHtml: toBulletList(item.description ?? ''),
  }));
  const experience = mapItems(doc.experience, (item) => ({
    ...item,
    period: range(item),
    descriptionHtml: toBulletList(item.description ?? ''),
  }));
  const projects = mapItems(doc.projects, (item) => ({
    ...item,
    period: range(item),
    linkHref: toHref(item.link ?? ''),
    descriptionHtml: toBulletList(item.description ?? ''),
  }));
  const skills = mapItems(doc.skills, (item) => ({
    ...item,
    sep: labels.skillSep,
    itemsText: lines(item.items ?? '')
      .flatMap((line) => line.split(/[、,，]/))
      .map((s) => s.trim())
      .filter(Boolean)
      .join(meta.locale === 'zh-CN' ? '、' : ', '),
  }));
  const certificates = doc.certificates
    .filter((item) => !isBlankItem(item))
    .map((item) => ({ ...item, date: formatDate(item.date ?? '', meta.locale, format) }));
  const customSections = mapItems(doc.customSections, (item) => ({
    ...item,
    contentHtml: toBulletList(item.content ?? ''),
  }));
  const contactsHtml = buildContacts(doc, contactSep);

  return {
    lang: meta.locale,
    labels,
    profile: {
      ...profile,
      avatarAlign: profile.avatarAlign ?? 'left',
      summaryHtml: toParagraph(profile.summary),
      websiteHref: toHref(profile.website),
      emailHref: profile.email && EMAIL_RE.test(profile.email.trim()) ? `mailto:${profile.email.trim()}` : '',
    },
    contactsHtml,
    education,
    experience,
    projects,
    skills,
    certificates,
    customSections,
    hasEducation: education.length > 0,
    hasExperience: experience.length > 0,
    hasProjects: projects.length > 0,
    hasSkills: skills.length > 0,
    hasCertificates: certificates.length > 0,
    hasContact: contactsHtml.length > 0,
  };
}
