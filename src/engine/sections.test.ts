import { describe, expect, it } from 'vitest';
import { reorderSections } from './sections';

const html = [
  '<header class="block header"><h1>Alex</h1></header>',
  '<section class="block" data-section="summary"><h2>Summary</h2></section>',
  '<section data-section="experience"><h2>Experience</h2></section>',
  '<section class="block" data-section="skills"><h2>Skills</h2></section>',
].join('\n');

describe('reorderSections', () => {
  it('按给定顺序重排分区，header 始终在最前', () => {
    const out = reorderSections(html, ['skills', 'experience', 'summary']);
    expect(out.indexOf('<header')).toBe(0);
    expect(out.indexOf('Skills')).toBeLessThan(out.indexOf('Experience'));
    expect(out.indexOf('Experience')).toBeLessThan(out.indexOf('Summary'));
  });

  it('顺序里缺失的分区排到最后，不会丢失内容', () => {
    const out = reorderSections(html, ['skills']);
    expect(out).toContain('Summary');
    expect(out).toContain('Experience');
    expect(out.indexOf('Skills')).toBeLessThan(out.indexOf('Summary'));
  });

  it('同一分区的多个元素保持相邻', () => {
    const withCustom = [
      '<header></header>',
      '<section data-section="customSections"><h2>A</h2></section>',
      '<section data-section="skills"><h2>Skills</h2></section>',
      '<section data-section="customSections"><h2>B</h2></section>',
    ].join('\n');
    const out = reorderSections(withCustom, ['customSections', 'skills']);
    const aIndex = out.indexOf('>A<');
    const bIndex = out.indexOf('>B<');
    const skillsIndex = out.indexOf('Skills');
    expect(aIndex).toBeLessThan(bIndex);
    expect(bIndex).toBeLessThan(skillsIndex);
  });

  it('没有分区标记时原样返回', () => {
    expect(reorderSections('<p>hello</p>', ['summary'])).toBe('<p>hello</p>');
  });
});
