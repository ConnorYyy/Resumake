import { getTemplate } from '../templates';
import { prepareContext } from './context';
import { renderTemplate } from './render';
import { reorderSections } from './sections';
import { sanitizeCss, type CssWarning } from './css';
import { buildDocument } from './document';
import { translate } from '../i18n/translate';
import type { Locale, ResumeDoc } from '../types';

/** 高级编辑中代替照片数据的占位文字，输出时会替换回真实照片 */
export function avatarToken(locale: Locale): string {
  return locale === 'en-US' ? '[Photo]' : '[照片]';
}

/** 旧版本使用的占位符也要兼容，保证已保存的内容仍可输出照片 */
const LEGACY_AVATAR_TOKENS = ['{{profile.avatar}}'];

export interface ComposeResult {
  /** 最终输出到预览与导出的 body 片段 */
  bodyHtml: string;
  /** 模板渲染结果（含真实照片数据），用于判断是否脱离绑定 */
  renderedHtml: string;
  /** 供代码编辑器展示的 HTML（照片替换为占位符） */
  editableHtml: string;
  srcdoc: string;
  cssWarnings: CssWarning[];
  templateName: string;
}

function replaceAll(text: string, from: string, to: string): string {
  return from ? text.split(from).join(to) : text;
}

/** 根据简历数据、模板与主题组装完整文档（预览与打印共用） */
export function composeResume(doc: ResumeDoc): ComposeResult {
  const template = getTemplate(doc.meta.templateId) ?? getTemplate('classic')!;
  const avatar = doc.profile.avatar ?? '';
  const renderedHtml = reorderSections(
    renderTemplate(template.html, prepareContext(doc, template.contactSep)),
    doc.meta.sectionOrder,
  );
  const token = avatarToken(doc.meta.locale);
  const editableHtml = replaceAll(renderedHtml, avatar, token);
  const bodyHtml =
    doc.meta.customHtml !== null
      ? [...new Set([token, '[照片]', '[Photo]', ...LEGACY_AVATAR_TOKENS])].reduce(
          (html, t) => replaceAll(html, t, avatar),
          doc.meta.customHtml,
        )
      : renderedHtml;
  const { css, warnings } = sanitizeCss(doc.meta.customCss);
  const name = doc.profile.name.trim();
  const title = name
    ? translate(doc.meta.locale, 'doc.title', { name })
    : translate(doc.meta.locale, 'doc.titleUntitled');

  const srcdoc = buildDocument({
    bodyHtml,
    templateCss: template.css,
    customCss: css,
    paper: doc.meta.paperSize,
    margin: doc.meta.margin,
    locale: doc.meta.locale,
    title,
    themeColor: doc.meta.themeColor,
    fontScale: doc.meta.fontScale,
  });

  return { bodyHtml, renderedHtml, editableHtml, srcdoc, cssWarnings: warnings, templateName: template.name };
}
