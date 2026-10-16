import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLocale } from './locale';

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
