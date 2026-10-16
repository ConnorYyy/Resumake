import { describe, expect, it } from 'vitest';
import { renderTemplate } from './render';

describe('renderTemplate', () => {
  it('转义普通变量并保留原样变量', () => {
    const out = renderTemplate('{{name}}|{{{html}}}', { name: '<b>A&B</b>', html: '<i>x</i>' });
    expect(out).toBe('&lt;b&gt;A&amp;B&lt;/b&gt;|<i>x</i>');
  });

  it('支持数组遍历与子项字段回退到父作用域', () => {
    const out = renderTemplate('{{#items}}[{{title}}:{{tag}}]{{/items}}', {
      tag: 'T',
      items: [{ title: 'a' }, { title: 'b', tag: 'U' }],
    });
    expect(out).toBe('[a:T][b:U]');
  });

  it('真值与假值段落', () => {
    expect(renderTemplate('{{#show}}yes{{/show}}{{^show}}no{{/show}}', { show: true })).toBe('yes');
    expect(renderTemplate('{{#show}}yes{{/show}}{{^show}}no{{/show}}', { show: false })).toBe('no');
    expect(renderTemplate('{{#list}}x{{/list}}{{^list}}empty{{/list}}', { list: [] })).toBe('empty');
  });

  it('支持点路径', () => {
    expect(renderTemplate('{{a.b.c}}', { a: { b: { c: 'deep' } } })).toBe('deep');
  });

  it('缺失变量输出空字符串', () => {
    expect(renderTemplate('[{{missing}}]', {})).toBe('[]');
  });

  it('标签不匹配时抛出错误', () => {
    expect(() => renderTemplate('{{#a}}x{{/b}}', {})).toThrow();
    expect(() => renderTemplate('{{#a}}x', {})).toThrow();
  });
});
