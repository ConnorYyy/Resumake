/**
 * 分区排序：模板按固定顺序书写，这里根据用户设置重排顶层 <section> 元素。
 * 依赖模板为每个分区加上 data-section 标记；<header> 没有标记，始终排在最前。
 * 只处理顶层元素（分区之间不会互相嵌套），因此用简单的配对即可，无需完整 HTML 解析器。
 */
export function reorderSections(html: string, order: string[]): string {
  const blocks: { key: string; text: string }[] = [];
  let pos = 0;

  while (pos < html.length) {
    const match = /<(header|section)(?=[\s>])/.exec(html.slice(pos));
    if (!match) break;
    const tag = match[1];
    const start = pos + match.index;
    const closeIndex = html.indexOf(`</${tag}>`, start);
    if (closeIndex === -1) break;
    const end = closeIndex + tag.length + 3;
    const text = html.slice(start, end);
    const key = /data-section="([^"]+)"/.exec(text)?.[1] ?? '';
    blocks.push({ key, text });
    pos = end;
  }

  if (blocks.length === 0) return html;

  const rank = (key: string) => {
    if (!key) return -1; // header 始终最前
    const index = order.indexOf(key);
    return index === -1 ? order.length : index;
  };

  const groups: { key: string; rank: number; items: string[] }[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    // 同一分区的多个元素（自定义模块）保持相邻
    if (last && last.key === block.key) last.items.push(block.text);
    else groups.push({ key: block.key, rank: rank(block.key), items: [block.text] });
  }

  groups.sort((a, b) => a.rank - b.rank);
  return groups.map((group) => group.items.join('\n')).join('\n');
}
