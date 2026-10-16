import classicHtml from './classic/template.html?raw';
import classicCss from './classic/base.css?raw';
import modernHtml from './modern/template.html?raw';
import modernCss from './modern/base.css?raw';
import minimalHtml from './minimal/template.html?raw';
import minimalCss from './minimal/base.css?raw';
import type { TemplateInfo } from '../types';

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'classic',
    name: 'template.classic',
    description: 'template.classicDesc',
    html: classicHtml,
    css: classicCss,
    contactSep: ' | ',
  },
  {
    id: 'modern',
    name: 'template.modern',
    description: 'template.modernDesc',
    html: modernHtml,
    css: modernCss,
    contactSep: ' · ',
  },
  {
    id: 'minimal',
    name: 'template.minimal',
    description: 'template.minimalDesc',
    html: minimalHtml,
    css: minimalCss,
    contactSep: ' / ',
  },
];

export function getTemplate(id: string): TemplateInfo | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
