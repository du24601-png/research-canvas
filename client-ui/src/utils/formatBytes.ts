/**
 * 统一的字节数人类可读格式化（归一自 chat/mediaCapabilities.formatBytesShort 与
 * utils/systemUpdateImportValidation.formatImportFileSize —— 两套阶梯合并为行为超集）。
 *
 * 阶梯：<1KB → 原值 B；<1MB → KB（<10KB 保留 1 位小数，其余取整）；<1GB → 1 位小数 MB；
 * ≥1GB → 2 位小数 GB。
 *
 * 归一后的调用方行为变化点（均只在极端值可见）：
 * - 原 formatBytesShort：≥1GB 由「1536.0 MB」式改为「1.50 GB」式（新增 GB 档）。
 * - 原 formatImportFileSize：10KB–1MB 区间由固定 1 位小数改为 <10KB 才带小数（「48.0 KB」→「48 KB」）。
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
