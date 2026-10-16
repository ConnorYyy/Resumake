import { describe, expect, it } from 'vitest';
import { composeResume } from './compose';
import { createSample } from '../data/sample';
import { TEMPLATES } from '../templates';
import { createEmptyDoc } from '../data/factory';

describe('composeResume', () => {
  it.each(['zh-CN', 'en-US'] as const)('%s 示例数据渲染后无残留占位符', (locale) => {
    for (const template of TEMPLATES) {
      const doc = createSample(locale);
      doc.meta.templateId = template.id;
      const { bodyHtml, srcdoc } = composeResume(doc);
      expect(bodyHtml).not.toMatch(/\{\{/);
      expect(srcdoc).toContain(doc.profile.name);
      expect(srcdoc).toContain(`lang="${locale}"`);
    }
  });

  it('外部链接和邮箱生成正确的 href', () => {
    const doc = createSample('en-US');
    const { bodyHtml } = composeResume(doc);
    expect(bodyHtml).toContain('href="https://alexmorgan.dev"');
    expect(bodyHtml).toContain('href="mailto:alex.morgan@example.com"');
  });

  it('列表项中的 **加粗** 与转义', () => {
    const doc = createSample('zh-CN');
    doc.experience[0].description = '提升 **性能** <script>x</script>';
    const { bodyHtml } = composeResume(doc);
    expect(bodyHtml).toContain('<strong>性能</strong>');
    expect(bodyHtml).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  it('自定义 HTML 存在时优先使用，并且表单修改不影响输出', () => {
    const doc = createSample('zh-CN');
    doc.meta.customHtml = '<p>手写内容</p>';
    doc.profile.name = '新名字';
    const { bodyHtml, srcdoc } = composeResume(doc);
    expect(bodyHtml).toBe('<p>手写内容</p>');
    expect(srcdoc).toContain('<main class="resume-page">\n<p>手写内容</p>');
    expect(srcdoc).not.toContain('表单');
  });

  it('文档包含模板与基础样式', () => {
    const { srcdoc } = composeResume(createSample('zh-CN'));
    expect(srcdoc).toContain('.resume-page');
    expect(srcdoc).toContain('--accent');
  });

  it('设置照片后各模板都输出 img，未设置时不输出', () => {
    const avatar = 'data:image/jpeg;base64,/9j/AAAA';
    for (const template of TEMPLATES) {
      const doc = createSample('zh-CN');
      doc.meta.templateId = template.id;
      doc.profile.avatar = avatar;
      expect(composeResume(doc).bodyHtml).toContain(`<img class="photo photo-left" src="${avatar}"`);

      delete doc.profile.avatar;
      expect(composeResume(doc).bodyHtml).not.toContain('class="photo');
    }
  });

  it('照片对齐方式输出为类名，缺省为 left', () => {
    const doc = createSample('zh-CN');
    doc.profile.avatar = 'data:image/jpeg;base64,/9j/AAAA';
    expect(composeResume(doc).bodyHtml).toContain('class="photo photo-left"');
    doc.profile.avatarAlign = 'left';
    expect(composeResume(doc).bodyHtml).toContain('class="photo photo-left"');
    doc.profile.avatarAlign = 'right';
    expect(composeResume(doc).bodyHtml).toContain('class="photo photo-right"');
  });

  it('技能分隔符与文档标题跟随语言，不会在英文简历里混入中文标点', () => {
    const zh = createSample('zh-CN');
    zh.skills[0].category = '前端';
    zh.skills[0].items = 'Vue 3、TypeScript';
    const zhOut = composeResume(zh);
    expect(zhOut.bodyHtml).toContain('<strong>前端</strong>：Vue 3、TypeScript');
    expect(zhOut.srcdoc).toContain(`<title>${zh.profile.name} - 简历</title>`);
    expect(zhOut.bodyHtml).not.toContain('：</strong>');

    const en = createSample('en-US');
    en.skills[0].category = 'Frontend';
    en.skills[0].items = 'Vue 3, TypeScript';
    const enOut = composeResume(en);
    expect(enOut.bodyHtml).toContain('<strong>Frontend</strong>: Vue 3, TypeScript');
    expect(enOut.bodyHtml).not.toContain('：');
    expect(enOut.srcdoc).toContain(`<title>${en.profile.name} - Resume</title>`);
  });

  it('空简历的文档标题也不含中文混排', () => {
    const en = createEmptyDoc('en-US');
    expect(composeResume(en).srcdoc).toContain('<title>Resume</title>');
    const zh = createEmptyDoc('zh-CN');
    expect(composeResume(zh).srcdoc).toContain('<title>简历</title>');
  });

  it('代码编辑器中照片显示为占位符，自定义 HTML 中占位符在输出时还原', () => {
    const avatar = 'data:image/jpeg;base64,/9j/AAAA';
    const doc = createSample('zh-CN');
    doc.profile.avatar = avatar;
    const { editableHtml, bodyHtml } = composeResume(doc);
    expect(editableHtml).toContain('src="[照片]"');
    expect(editableHtml).not.toContain(avatar);
    expect(bodyHtml).toContain(avatar);

    doc.meta.customHtml = '<img src="{{profile.avatar}}">';
    expect(composeResume(doc).bodyHtml).toBe(`<img src="${avatar}">`);
  });

  it('主题色注入到模板之后，覆盖 --accent', () => {
    const doc = createSample('zh-CN');
    expect(composeResume(doc).srcdoc).not.toContain('--accent:#');
    doc.meta.themeColor = '#c2410c';
    const { srcdoc } = composeResume(doc);
    expect(srcdoc).toContain(':root{--accent:#c2410c;}');
    expect(srcdoc.indexOf(':root{--accent:#c2410c;}')).toBeGreaterThan(srcdoc.indexOf('.resume-page'));
  });

  it('空简历不渲染分区标题', () => {
    const doc = createEmptyDoc('zh-CN');
    const { bodyHtml } = composeResume(doc);
    expect(bodyHtml).not.toContain('工作经历');
    expect(bodyHtml).not.toContain('教育经历');
  });

  it('自定义 CSS 经过过滤后注入文档', () => {
    const doc = createSample('zh-CN');
    doc.meta.customCss = '@import url(https://x.test/a.css); h1 { color: red; }';
    const { srcdoc, cssWarnings } = composeResume(doc);
    expect(srcdoc).toContain('h1 { color: red; }');
    expect(srcdoc).not.toContain('@import url(https://x.test');
    expect(cssWarnings.length).toBeGreaterThan(0);
  });

  it('空白条目不会出现在输出里，也不会撑出分区标题', () => {
    const doc = createSample('en-US');
    doc.education.push({ id: 'blank', school: '', major: '', degree: '', period: '', periodStart: '', periodEnd: '', present: '', description: '' });
    const { bodyHtml } = composeResume(doc);
    expect(bodyHtml).toContain('University of Washington');
    expect((bodyHtml.match(/class="block entry"/g) ?? []).length).toBe(doc.experience.length + doc.projects.length + doc.education.length - 1);
  });

  it('联系方式之间有真实分隔符，非法邮箱不生成 mailto', () => {
    const doc = createSample('en-US');
    doc.meta.templateId = 'classic';
    const { bodyHtml } = composeResume(doc);
    expect(bodyHtml).toContain('<span class="sep"> | </span>');

    doc.profile.email = 'bad-email';
    const broken = composeResume(doc).bodyHtml;
    expect(broken).not.toContain('mailto:');
    expect(broken).not.toContain('bad-email');
  });

  it('日期按 meta.dateFormat 输出，并支持“至今”', () => {
    const doc = createSample('en-US');
    doc.meta.dateFormat = 'mmy';
    expect(composeResume(doc).bodyHtml).toContain('Jul 2020 - Present');

    doc.meta.dateFormat = 'my';
    doc.meta.locale = 'en-US';
    expect(composeResume(doc).bodyHtml).toContain('07.2020 - Present');

    const zh = createSample('zh-CN');
    expect(composeResume(zh).bodyHtml).toContain('2020.07 - 至今');
  });

  it('分区顺序按 meta.sectionOrder 生效，且不会打乱 header', () => {
    const doc = createSample('en-US');
    doc.meta.sectionOrder = ['education', 'experience', 'projects', 'summary', 'skills', 'certificates', 'customSections'];
    const { bodyHtml } = composeResume(doc);
    expect(bodyHtml.indexOf('<header')).toBe(0);
    expect(bodyHtml.indexOf('>Education<')).toBeLessThan(bodyHtml.indexOf('>Experience<'));
  });

  it('英文用西文字体栈，中文用中文字体栈', () => {
    expect(composeResume(createSample('en-US')).srcdoc).toContain("--font-body:'Segoe UI'");
    expect(composeResume(createSample('zh-CN')).srcdoc).toContain("--font-body:'Microsoft YaHei'");
  });

  it('标题为空的自定义模块不会渲染空标题', () => {
    const doc = createSample('zh-CN');
    doc.customSections.push({ id: 'c1', title: '', content: '一行内容' });
    const { bodyHtml } = composeResume(doc);
    expect(bodyHtml).toContain('一行内容');
    expect(bodyHtml).not.toMatch(/<h2>\s*<\/h2>/);
  });

  it('旧版自由文本时间会在输出时被结构化渲染', () => {
    const doc = createSample('zh-CN');
    doc.meta.dateFormat = 'ym';
    doc.experience = [{ id: 'e1', company: 'X', role: 'Y', period: '2019.05 - 至今', location: '', description: '' }];
    expect(composeResume(doc).bodyHtml).toContain('2019.05 - 至今');
  });
});

