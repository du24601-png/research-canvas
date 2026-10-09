/// <reference types="vite/client" />

declare const __OPPTRIX_CLIENT_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  /** '0' 关闭对话优先布局，恢复双栏研究画布 */
  readonly VITE_FINFRAME_CHAT_FIRST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
