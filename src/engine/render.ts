/**
 * 极简模板引擎，支持：
 *   {{path}}          转义输出
 *   {{{path}}}        原样输出（用于已预先生成的 HTML 片段）
 *   {{#path}}...{{/path}}  数组遍历 / 真值渲染
 *   {{^path}}...{{/path}}  假值渲染
 */

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'var'; name: string; raw: boolean }
  | { kind: 'section'; name: string; inverted: boolean; children: Node[] };

const TAG = /\{\{(\{)?\s*([#^/])?\s*([A-Za-z_][\w.]*)\s*\}\}(\})?/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parse(template: string): Node[] {
  const root: Node[] = [];
  const stack: { name: string; inverted: boolean; children: Node[] }[] = [];
  let current = root;
  let last = 0;
  let match: RegExpExecArray | null;
  TAG.lastIndex = 0;

  while ((match = TAG.exec(template)) !== null) {
    const [full, tripleOpen, sigil, name, tripleClose] = match;
    const isTriple = Boolean(tripleOpen && tripleClose);
    if (match.index > last) {
      current.push({ kind: 'text', value: template.slice(last, match.index) });
    }
    last = match.index + full.length;

    if (sigil === '#' || sigil === '^') {
      const section = { name, inverted: sigil === '^', children: [] as Node[] };
      current.push({ kind: 'section', ...section });
      stack.push(section);
      current = section.children;
    } else if (sigil === '/') {
      const open = stack.pop();
      if (!open) throw new Error(`模板错误：多余的 {{/${name}}}`);
      if (open.name !== name) throw new Error(`模板错误：{{#${open.name}}} 与 {{/${name}}} 不匹配`);
      current = stack.length ? stack[stack.length - 1].children : root;
    } else {
      current.push({ kind: 'var', name, raw: isTriple });
    }
  }

  if (last < template.length) {
    current.push({ kind: 'text', value: template.slice(last) });
  }
  if (stack.length) {
    throw new Error(`模板错误：{{#${stack[stack.length - 1].name}}} 未闭合`);
  }
  return root;
}

function lookup(name: string, scopes: unknown[]): unknown {
  const parts = name.split('.');
  for (let i = scopes.length - 1; i >= 0; i--) {
    let value: unknown = scopes[i];
    let found = true;
    for (const part of parts) {
      if (value === null || typeof value !== 'object' || !(part in (value as object))) {
        found = false;
        break;
      }
      value = (value as Record<string, unknown>)[part];
    }
    if (found) return value;
  }
  return undefined;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function renderNodes(nodes: Node[], scopes: unknown[]): string {
  let out = '';
  for (const node of nodes) {
    if (node.kind === 'text') {
      out += node.value;
    } else if (node.kind === 'var') {
      const text = stringify(lookup(node.name, scopes));
      out += node.raw ? text : escapeHtml(text);
    } else {
      const value = lookup(node.name, scopes);
      if (node.inverted) {
        const empty = !value || (Array.isArray(value) && value.length === 0);
        if (empty) out += renderNodes(node.children, scopes);
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          out += renderNodes(node.children, [...scopes, item]);
        }
      } else if (value) {
        const next = typeof value === 'object' ? [...scopes, value] : scopes;
        out += renderNodes(node.children, next);
      }
    }
  }
  return out;
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return renderNodes(parse(template), [data]);
}
