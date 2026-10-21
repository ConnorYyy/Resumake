import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLocale, localeFromSearch, parseLocaleParam, resolveInitialLocale } from './locale';

function withBrowserLanguages(languages: string[]) {
  vi.stubGlobal('navigator', { languages, language: languages[0] });
}

afterEach(() => vi.unstubAllGlobals());

describe('detectLocale', () => {
  it('中文浏览器使用中文', () => {
    withBrowserLanguages(['zh-CN', 'zh']);
    expect(detectLocale()).toBe('zh-CN');
  });

  it('中文变体（繁体、新加坡）也使用中文', () => {
    withBrowserLanguages(['zh-Hant-TW']);
    expect(detectLocale()).toBe('zh-CN');
    withBrowserLanguages(['zh-Hans-SG']);
    expect(detectLocale()).toBe('zh-CN');
  });

  it('英文浏览器使用英文', () => {
    withBrowserLanguages(['en-US', 'en']);
    expect(detectLocale()).toBe('en-US');
  });

  it('其他语言一律回退到英文（面向海外用户）', () => {
    withBrowserLanguages(['fr-FR', 'fr']);
    expect(detectLocale()).toBe('en-US');
    withBrowserLanguages(['de']);
    expect(detectLocale()).toBe('en-US');
  });

  it('只有 navigator.language 时也能判断', () => {
    vi.stubGlobal('navigator', { languages: [], language: 'zh-CN' });
    expect(detectLocale()).toBe('zh-CN');
  });
});

describe('parseLocaleParam', () => {
  it('识别中英文及常见变体', () => {
    expect(parseLocaleParam('en')).toBe('en-US');
    expect(parseLocaleParam('EN')).toBe('en-US');
    expect(parseLocaleParam('en-GB')).toBe('en-US');
    expect(parseLocaleParam('zh')).toBe('zh-CN');
    expect(parseLocaleParam('zh-CN')).toBe('zh-CN');
    expect(parseLocaleParam('zh-Hant-TW')).toBe('zh-CN');
  });

  it('不认识或为空的值返回 null', () => {
    expect(parseLocaleParam('fr')).toBeNull();
    expect(parseLocaleParam('')).toBeNull();
    expect(parseLocaleParam('   ')).toBeNull();
    expect(parseLocaleParam(null)).toBeNull();
  });
});

describe('localeFromSearch', () => {
  it('从查询字符串读取 lang', () => {
    expect(localeFromSearch('?lang=en')).toBe('en-US');
    expect(localeFromSearch('?lang=zh')).toBe('zh-CN');
    expect(localeFromSearch('?ref=home&lang=zh')).toBe('zh-CN');
  });

  it('没有参数或参数非法时返回 null', () => {
    expect(localeFromSearch('')).toBeNull();
    expect(localeFromSearch('?foo=bar')).toBeNull();
    expect(localeFromSearch('?lang=fr')).toBeNull();
  });
});

describe('resolveInitialLocale', () => {
  it('URL 参数优先于浏览器语言', () => {
    withBrowserLanguages(['zh-CN']);
    vi.stubGlobal('location', { search: '?lang=en' });
    expect(resolveInitialLocale()).toBe('en-US');
  });

  it('中文站链接让中文浏览器保持中文', () => {
    withBrowserLanguages(['en-US']);
    vi.stubGlobal('location', { search: '?lang=zh' });
    expect(resolveInitialLocale()).toBe('zh-CN');
  });

  it('没有参数时回退到浏览器语言', () => {
    withBrowserLanguages(['zh-CN']);
    vi.stubGlobal('location', { search: '' });
    expect(resolveInitialLocale()).toBe('zh-CN');
  });
});
