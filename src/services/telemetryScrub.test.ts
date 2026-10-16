import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/vue';
import { sanitizeText, scrubEvent } from './telemetryScrub';

function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return { type: undefined, event_id: 'e1', ...overrides } as ErrorEvent;
}

describe('sanitizeText', () => {
  it('抹掉图片 data URL、邮箱、网址与超长串', () => {
    const text = sanitizeText(
      'failed data:image/jpeg;base64,AAAA1111BBBB2222CCCC for jordan.mitchell@example.com at https://example.com/a/b?x=1 token ' +
        'a'.repeat(40),
    );
    expect(text).not.toContain('data:image');
    expect(text).not.toContain('jordan.mitchell');
    expect(text).not.toContain('example.com/a/b');
    expect(text).not.toContain('a'.repeat(40));
    expect(text).toContain('[data-url]');
    expect(text).toContain('[email]');
    expect(text).toContain('[url]');
    expect(text).toContain('[token]');
  });

  it('清空引号里的内容（JSON 解析报错会夹带文件正文）', () => {
    const text = sanitizeText('Unexpected token \'J\', "Jordan A. Mitchell" is not valid JSON');
    expect(text).not.toContain('Jordan');
    expect(text).toContain('is not valid JSON');
  });

  it('压平空白并截断超长文本', () => {
    const text = sanitizeText(`line1\n\nline2   line3 ${'word '.repeat(40)}`, 40);
    expect(text).not.toContain('\n');
    expect(text).not.toMatch(/\s{2,}/);
    expect(text.length).toBe(41);
    expect(text.endsWith('…')).toBe(true);
  });

  it('非字符串返回空串', () => {
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText({ name: 'Jordan' })).toBe('');
  });
});

describe('scrubEvent', () => {
  it('删除用户信息、面包屑与自定义附加数据', () => {
    const event = makeEvent({
      user: { id: 'jordan.mitchell@example.com', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'typed Jordan A. Mitchell' }],
      extra: { doc: { name: 'Jordan A. Mitchell' } },
      threads: { values: [{ id: 1 }] },
    } as Partial<ErrorEvent>);

    const out = scrubEvent(event);

    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.threads).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('Jordan');
  });

  it('清洗错误文本但保留错误类型与栈帧位置', () => {
    const event = makeEvent({
      message: 'boom "+1 512-555-0148"',
      exception: {
        values: [
          {
            type: 'SyntaxError',
            value: 'Unexpected token \'J\', "Jordan A. Mitchell" is not valid JSON',
            stacktrace: {
              frames: [
                {
                  filename: '/assets/app.js',
                  lineno: 12,
                  colno: 3,
                  vars: { doc: { name: 'Jordan A. Mitchell' } },
                  context_line: 'const x = "Jordan A. Mitchell"',
                  pre_context: ['// Jordan A. Mitchell'],
                  post_context: ['// resume'],
                },
              ],
            },
          },
        ],
      },
    } as Partial<ErrorEvent>);

    const out = scrubEvent(event);
    const value = out.exception?.values?.[0];

    expect(value?.type).toBe('SyntaxError');
    expect(value?.value).not.toContain('Jordan');
    expect(value?.value).not.toContain('512-555-0148');
    expect(value?.stacktrace?.frames?.[0]?.filename).toBe('/assets/app.js');
    expect(value?.stacktrace?.frames?.[0]?.lineno).toBe(12);
    expect(value?.stacktrace?.frames?.[0]?.vars).toBeUndefined();
    expect(value?.stacktrace?.frames?.[0]?.context_line).toBeUndefined();
    expect(value?.stacktrace?.frames?.[0]?.pre_context).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('Jordan');
  });

  it('网址只保留路径，去掉查询串与 hash', () => {
    const out = scrubEvent(makeEvent({ request: { url: 'https://site.test/app/?email=a@b.com#top' } } as Partial<ErrorEvent>));
    expect(out.request).toEqual({ url: 'https://site.test/app/' });
  });

  it('没有网址时清空 request', () => {
    const out = scrubEvent(makeEvent({ request: {} } as Partial<ErrorEvent>));
    expect(out.request).toEqual({});
  });

  it('删除 Vue 组件上下文与设备信息，保留浏览器信息', () => {
    const event = makeEvent({
      contexts: {
        vue: { componentName: 'FormPanel', props: { value: 'Jordan A. Mitchell' } },
        device: { screen_resolution: '1920x1080' },
        browser: { name: 'Chrome', version: '130.0' },
        os: { name: 'Windows' },
      },
    } as Partial<ErrorEvent>);

    const out = scrubEvent(event);

    expect(out.contexts?.vue).toBeUndefined();
    expect(out.contexts?.device).toBeUndefined();
    expect(out.contexts?.browser).toEqual({ name: 'Chrome', version: '130.0' });
    expect(JSON.stringify(out)).not.toContain('Jordan');
  });
});
