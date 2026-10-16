/**
 * 解析颜色输入，支持：
 *   #rgb / #rrggbb
 *   rgb(r, g, b)
 *   r, g, b（逗号、空格或全角逗号分隔）
 * 返回小写的 #rrggbb，无法识别时返回 null。
 */
export function parseColor(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  const hex = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return `#${digits}`;
  }

  const rgb = value.match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*[,，\s]\s*(\d{1,3})\s*[,，\s]\s*(\d{1,3})\s*\)?$/);
  if (rgb) {
    const channels = rgb.slice(1, 4).map(Number);
    if (channels.some((c) => c > 255)) return null;
    return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
  }

  return null;
}
