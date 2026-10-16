import { describe, expect, it } from 'vitest';
import { sanitizeCss } from './css';

describe('sanitizeCss', () => {
  it('保留普通样式不产生警告', () => {
    const result = sanitizeCss('h1 { color: red; }');
    expect(result.css).toBe('h1 { color: red; }');
    expect(result.warnings).toEqual([]);
  });

  it('移除 @import', () => {
    const result = sanitizeCss('@import url("https://evil.test/a.css");\np { margin: 0 }');
    expect(result.css).not.toContain('@import');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('外部 url() 替换为 none，本地 data 图片保留', () => {
    const external = sanitizeCss('.a { background: url(https://x.test/a.png); }');
    expect(external.css).toBe('.a { background: none; }');
    expect(external.warnings.length).toBe(1);

    const dataUri = sanitizeCss('.a { background: url(data:image/png;base64,AAAA); }');
    expect(dataUri.css).toContain('data:image/png');
    expect(dataUri.warnings).toEqual([]);
  });

  it('阻止 </style> 注入与脚本语法', () => {
    const result = sanitizeCss('p{}</style><script>alert(1)</script>');
    expect(result.css).not.toMatch(/<\/style/i);
    const exp = sanitizeCss('p { width: expression(alert(1)); }');
    expect(exp.css).not.toContain('expression(');
    expect(exp.warnings).toContainEqual({ key: 'css.expression' });
  });
});
