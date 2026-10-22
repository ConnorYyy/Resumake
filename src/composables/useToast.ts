import { readonly, ref } from 'vue';

export interface Toast {
  id: number;
  text: string;
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

/** 轻提示：切换语言、切模板、压缩到一页等操作的反馈 */
export function showToast(text: string, ms = 3200): void {
  const id = (nextId += 1);
  toasts.value = [...toasts.value, { id, text }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }, ms);
}

export function useToast() {
  return { toasts: readonly(toasts) };
}
