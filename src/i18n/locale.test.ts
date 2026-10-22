import { afterEach, describe, expect, it, vi } from 'vitest';
import { localeFromSearch, parseLocaleParam, resolveInitialLocale } from './locale';

afterEach(() => vi.unstubAllGlobals());

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
  it('地址上没有参数时默认英文，与浏览器语言无关', () => {
    vi.stubGlobal('navigator', { languages: ['zh-CN', 'zh'], language: 'zh-CN' });
    vi.stubGlobal('location', { search: '' });
    expect(resolveInitialLocale()).toBe('en-US');
  });

  it('从中文落地页进来（?lang=zh）时用中文', () => {
    vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });
    vi.stubGlobal('location', { search: '?lang=zh' });
    expect(resolveInitialLocale()).toBe('zh-CN');
  });

  it('从英文落地页进来（?lang=en）时用英文', () => {
    vi.stubGlobal('navigator', { languages: ['zh-CN'], language: 'zh-CN' });
    vi.stubGlobal('location', { search: '?lang=en' });
    expect(resolveInitialLocale()).toBe('en-US');
  });
});
