import type { ListItem, Locale, ResumeDoc } from '../types';
import { createEmptyDoc, uid } from './factory';

function item(fields: Record<string, string>): ListItem {
  return { id: uid(), ...fields };
}

const sampleZh = (): ResumeDoc => ({
  ...createEmptyDoc('zh-CN'),
  profile: {
    name: '张明远',
    title: '前端开发工程师',
    phone: '138-0000-0000',
    email: 'zhang.mingyuan@example.com',
    website: 'github.com/zhangmy',
    linkedin: '',
    location: '上海',
    workAuth: '',
    summary: '4 年前端开发经验，专注于 Vue 生态与前端工程化。熟悉性能优化与可访问性，能够独立负责中大型中后台系统的设计与交付。',
  },
  education: [
    item({
      school: '华东理工大学',
      major: '计算机科学与技术',
      degree: '本科',
      periodStart: '2016-09',
      periodEnd: '2020-06',
      present: '',
      description: '主修数据结构、操作系统、计算机网络\n校级优秀毕业生',
    }),
  ],
  experience: [
    item({
      company: '某科技有限公司',
      role: '前端开发工程师',
      periodStart: '2020-07',
      periodEnd: '',
      present: '1',
      location: '上海',
      description:
        '负责企业级 SaaS 后台的前端架构，将首屏加载时间降低 **40%**\n主导组件库建设，沉淀 30+ 通用组件，服务 5 个业务线\n推动 TypeScript 迁移与单元测试覆盖率提升至 75%',
    }),
  ],
  projects: [
    item({
      name: '简历生成平台',
      role: '独立开发',
      periodStart: '2025-03',
      periodEnd: '2025-06',
      present: '',
      link: 'github.com/zhangmy/resume-demo',
      description: '基于 HTML 模板与 CSS 主题的简历生成工具\n支持浏览器原生打印导出可选中文本的 PDF',
    }),
  ],
  skills: [
    item({ category: '前端', items: 'Vue 3、TypeScript、Vite、Pinia、React、CSS 工程化' }),
    item({ category: '工具', items: 'Git、Docker、Vitest、Playwright' }),
  ],
  certificates: [item({ name: '全国大学英语六级 (CET-6)', issuer: '', date: '2019-12' })],
  customSections: [],
});

const sampleEn = (): ResumeDoc => ({
  ...createEmptyDoc('en-US'),
  profile: {
    name: 'Alex Morgan',
    title: 'Frontend Engineer',
    phone: '+1 555 010 2030',
    email: 'alex.morgan@example.com',
    website: 'alexmorgan.dev',
    linkedin: 'linkedin.com/in/alexmorgan',
    location: 'Seattle, WA',
    workAuth: 'Authorized to work in the US without sponsorship',
    summary: 'Frontend engineer with 4+ years of experience building design systems and data-heavy web applications with Vue and TypeScript.',
  },
  education: [
    item({
      school: 'University of Washington',
      major: 'Computer Science',
      degree: 'B.S.',
      periodStart: '2016',
      periodEnd: '2020',
      present: '',
      description: "Dean's List, four consecutive semesters",
    }),
  ],
  experience: [
    item({
      company: 'Northwind Labs',
      role: 'Frontend Engineer',
      periodStart: '2020-07',
      periodEnd: '',
      present: '1',
      location: 'Seattle, WA',
      description:
        'Led the migration of a legacy dashboard to Vue 3, cutting **bundle size by 35%**\nBuilt an internal component library used by five product teams\nIncreased unit test coverage from 40% to 80%',
    }),
  ],
  projects: [
    item({
      name: 'Resumake',
      role: 'Creator',
      periodStart: '2026',
      periodEnd: '',
      present: '',
      link: 'github.com/alexmorgan/resumake',
      description: 'HTML-template based resume builder with print-to-PDF export\nSupports A4 and Letter with selectable text and clickable links',
    }),
  ],
  skills: [
    item({ category: 'Frontend', items: 'TypeScript, Vue 3, Vite, Pinia, CSS, Accessibility' }),
    item({ category: 'Tools', items: 'Git, Docker, Vitest, Playwright' }),
  ],
  certificates: [item({ name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', date: '2023' })],
  customSections: [],
});

export function createSample(locale: Locale): ResumeDoc {
  return locale === 'zh-CN' ? sampleZh() : sampleEn();
}
