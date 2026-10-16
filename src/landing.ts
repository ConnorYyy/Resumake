import { initTelemetry } from './services/telemetry';

/**
 * 落地页入口：只做崩溃上报。
 * 落地页没有 Vue 实例，因此不传 app；隐私配置与编辑器完全一致（见 services/telemetry.ts）。
 */
initTelemetry();
