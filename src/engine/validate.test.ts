import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidPhone, isValidUrl, validateResumeFile } from './validate';
import { createSample } from '../data/sample';

describe('validateResumeFile', () => {
  it('接受示例数据导出的 JSON 并保持内容', () => {
    const sample = createSample('zh-CN');
    const json = JSON.parse(JSON.stringify(sample));
    const result = validateResumeFile(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.profile.name).toBe(sample.profile.name);
      expect(result.doc.experience.length).toBe(sample.experience.length);
    }
  });

  it('拒绝非对象与错误版本', () => {
    expect(validateResumeFile(null).ok).toBe(false);
    expect(validateResumeFile({ version: '2.0', meta: {}, profile: {} }).ok).toBe(false);
  });

  it('拒绝未知模板', () => {
    const json = JSON.parse(JSON.stringify(createSample('en-US')));
    json.meta.templateId = 'unknown';
    const result = validateResumeFile(json);
    expect(result.ok).toBe(false);
  });

  it('列表字段类型错误时拒绝导入', () => {
    const json = JSON.parse(JSON.stringify(createSample('zh-CN')));
    json.education = 'not-array';
    expect(validateResumeFile(json).ok).toBe(false);
  });

  it('保留合法照片，丢弃非图片或注入类内容', () => {
    const base = JSON.parse(JSON.stringify(createSample('zh-CN')));

    base.profile.avatar = 'data:image/png;base64,iVBORw0KGgo=';
    const ok = validateResumeFile(base);
    expect(ok.ok && ok.doc.profile.avatar).toBe('data:image/png;base64,iVBORw0KGgo=');

    base.profile.avatar = '"><script>alert(1)</script>';
    const bad = validateResumeFile(base);
    expect(bad.ok && bad.doc.profile.avatar).toBeUndefined();

    base.profile.avatar = 'data:image/svg+xml;base64,PHN2Zy8+';
    const svg = validateResumeFile(base);
    expect(svg.ok && svg.doc.profile.avatar).toBeUndefined();
  });

  it('主题色仅接受 #rrggbb 格式', () => {
    const base = JSON.parse(JSON.stringify(createSample('zh-CN')));
    base.meta.themeColor = '#0f766e';
    const ok = validateResumeFile(base);
    expect(ok.ok && ok.doc.meta.themeColor).toBe('#0f766e');

    base.meta.themeColor = 'red;}body{display:none';
    const bad = validateResumeFile(base);
    expect(bad.ok && bad.doc.meta.themeColor).toBe('');
  });

  it('照片对齐仅接受 left/center/right', () => {
    const base = JSON.parse(JSON.stringify(createSample('zh-CN')));
    base.profile.avatarAlign = 'center';
    const ok = validateResumeFile(base);
    expect(ok.ok && ok.doc.profile.avatarAlign).toBe('center');

    base.profile.avatarAlign = 'javascript:evil';
    const bad = validateResumeFile(base);
    expect(bad.ok && bad.doc.profile.avatarAlign).toBeUndefined();
  });

  it('缺失的条目 id 会自动补齐，缺失字段补为空字符串', () => {
    const json = JSON.parse(JSON.stringify(createSample('zh-CN')));
    json.skills = [{ category: 'X' }];
    const result = validateResumeFile(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.skills[0].id).toBeTruthy();
      expect(result.doc.skills[0].items).toBe('');
    }
  });
});

describe('格式校验', () => {
  it('邮箱、电话、网址', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('bad-email')).toBe(false);
    expect(isValidPhone('138-0000-0000')).toBe(true);
    expect(isValidPhone('available on request')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidUrl('github.com/x')).toBe(true);
    expect(isValidUrl('not a url')).toBe(false);
  });
});

describe('导入时的迁移与规范化', () => {
  it('旧版自由文本时间迁移为结构化日期，并清掉原文本', () => {
    const json = JSON.parse(JSON.stringify(createSample('zh-CN')));
    json.experience = [{ id: 'e1', company: 'X', role: 'Y', period: '2016.09 - 2020.06', location: '', description: '' }];
    const result = validateResumeFile(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const item = result.doc.experience[0];
      expect(item.periodStart).toBe('2016-09');
      expect(item.periodEnd).toBe('2020-06');
      expect(item.period).toBe('');
    }
  });

  it('无法解析的时间原样保留，不会丢内容', () => {
    const json = JSON.parse(JSON.stringify(createSample('zh-CN')));
    json.experience = [{ id: 'e1', company: 'X', role: 'Y', period: 'Summer 2019', location: '', description: '' }];
    const result = validateResumeFile(json);
    expect(result.ok && result.doc.experience[0].period).toBe('Summer 2019');
  });

  it('证书时间迁移为 YYYY-MM', () => {
    const json = JSON.parse(JSON.stringify(createSample('zh-CN')));
    json.certificates = [{ id: 'c1', name: 'CET-6', date: '2019.12' }];
    const result = validateResumeFile(json);
    expect(result.ok && result.doc.certificates[0].date).toBe('2019-12');
  });

  it('分区顺序去重并补齐缺失的分区', () => {
    const json = JSON.parse(JSON.stringify(createSample('en-US')));
    json.meta.sectionOrder = ['skills', 'skills', 'bogus'];
    const result = validateResumeFile(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const order = result.doc.meta.sectionOrder;
      expect(order[0]).toBe('skills');
      expect(new Set(order).size).toBe(order.length);
      expect(order).toContain('education');
      expect(order).toContain('customSections');
    }
  });

  it('字号缩放被限制在 0.8 ~ 1.2，非法日期格式回落到默认值', () => {
    const json = JSON.parse(JSON.stringify(createSample('en-US')));
    json.meta.fontScale = 5;
    json.meta.dateFormat = 'nonsense';
    const result = validateResumeFile(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.meta.fontScale).toBe(1.2);
      expect(result.doc.meta.dateFormat).toBe('ym');
    }
  });

  it('分区标题按语言分别保存，非法键被丢弃', () => {
    const json = JSON.parse(JSON.stringify(createSample('zh-CN')));
    json.meta.sectionTitles = {
      'zh-CN': { experience: '工作履历', bogus: 'x' },
      'en-US': { skills: 'Tech Stack' },
    };
    const result = validateResumeFile(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.meta.sectionTitles['zh-CN']?.experience).toBe('工作履历');
      expect(result.doc.meta.sectionTitles['en-US']?.skills).toBe('Tech Stack');
      expect(Object.keys(result.doc.meta.sectionTitles['zh-CN'] ?? {})).toEqual(['experience']);
    }
  });
});
