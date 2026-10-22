import { ref } from 'vue';
import { aiEnabled } from '../services/aiRewrite';

/**
 * AI 是否可用：组件挂载时探测一次，全局共享同一个结果。
 * 探测失败（离线、接口不存在）一律当作不可用，不显示按钮。
 */
const available = ref(false);
let started = false;

export function useAiAvailability() {
  if (!started) {
    started = true;
    void aiEnabled().then((enabled) => {
      available.value = enabled;
    });
  }
  return { aiAvailable: available };
}
