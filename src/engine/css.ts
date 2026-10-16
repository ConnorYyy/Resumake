/** 警告以文案键 + 参数的形式返回，由界面按当前语言翻译 */
export interface CssWarning {
  key: string;
  params?: Record<string, string>;
}

export interface SanitizeResult {
  css: string;
  warnings: CssWarning[];
}

const DANGEROUS_PATTERNS: { pattern: RegExp; key: string }[] = [
  { pattern: /expression\s*\(/gi, key: 'css.expression' },
  { pattern: /javascript\s*:/gi, key: 'css.javascript' },
  { pattern: /behavior\s*:/gi, key: 'css.behavior' },
  { pattern: /-moz-binding\s*:/gi, key: 'css.mozBinding' },
];

function isExternalUrl(raw: string): boolean {
  const url = raw.trim().replace(/^['"]|['"]$/g, '');
  if (/^data:image\//i.test(url)) return false;
  return /^(https?:)?\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url);
}

/**
 * 过滤用户自定义 CSS：
 * - 移除 @import（禁止加载外部样式）
 * - 外部 url() 替换为 none（禁止外部资源请求）
 * - 移除脚本相关语法，并阻止 </style> 注入
 */
export function sanitizeCss(input: string): SanitizeResult {
  const warnings: CssWarning[] = [];
  let css = input.replace(/<\/style/gi, '');

  css = css.replace(/@import\b[^;]*;?/gi, () => {
    warnings.push({ key: 'css.importRemoved' });
    return '';
  });

  css = css.replace(/url\(\s*([^)]*?)\s*\)/gi, (whole, target: string) => {
    if (!isExternalUrl(target)) return whole;
    warnings.push({ key: 'css.externalUrl', params: { url: target.trim() } });
    return 'none';
  });

  for (const { pattern, key } of DANGEROUS_PATTERNS) {
    if (pattern.test(css)) {
      warnings.push({ key });
      css = css.replace(pattern, '');
    }
    pattern.lastIndex = 0;
  }

  const unique = new Map<string, CssWarning>();
  for (const warning of warnings) {
    unique.set(`${warning.key}|${JSON.stringify(warning.params ?? {})}`, warning);
  }
  return { css, warnings: Array.from(unique.values()) };
}
