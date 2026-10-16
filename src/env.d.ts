/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 崩溃上报用的 Sentry DSN，未设置则完全不上报 */
  readonly VITE_SENTRY_DSN?: string;
  /** 设为 '1' 时在开发环境也发送上报（仅用于验证接入） */
  readonly VITE_SENTRY_DEV?: string;
  /** 构建时由 vite.config.ts 注入的版本号，用于 Sentry release */
  readonly VITE_APP_RELEASE?: string;
  /** Buy Me a Coffee 赞助入口，未设置则不显示 */
  readonly VITE_BMC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
