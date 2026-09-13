import { PRODUCT_BRAND } from '../../branding/productBrand'

/** 项目启动年份 — 版权与关于页元数据 */
export const PRODUCT_PROJECT_START_YEAR = 2026

/** 版权人 / 项目标识（关于页与元数据） */
export const PRODUCT_COPYRIGHT_HOLDER = PRODUCT_BRAND.name

export function isChineseUiLocale(locale = typeof navigator !== 'undefined' ? navigator.language : 'zh-CN'): boolean {
  return locale.toLowerCase().startsWith('zh')
}

export function getProductCopyrightHolderLabel(locale?: string): string {
  return PRODUCT_COPYRIGHT_HOLDER
}

/** @deprecated 使用 getProductCopyrightHolderLabel */
export function getOpptrixCopyrightHolderLabel(locale?: string): string {
  return getProductCopyrightHolderLabel(locale)
}

/** @deprecated 使用 getProductCopyrightHolderLabel */
export function getOpptrixContributorsLabel(locale?: string): string {
  return getProductCopyrightHolderLabel(locale)
}

/** @deprecated 产品 About 页不再展示；保留供旧引用编译通过 */
export function formatAboutCopyrightLine(locale?: string): string {
  return formatOpenSourceAttributionLine(locale)
}

export function formatOpenSourceAttributionLine(locale?: string): string {
  const holder = getProductCopyrightHolderLabel(locale)
  if (isChineseUiLocale(locale)) {
    return `Copyright © ${PRODUCT_PROJECT_START_YEAR} ${holder}。基于 Apache License 2.0 发布。`
  }
  return `Copyright © ${PRODUCT_PROJECT_START_YEAR} ${holder}. Licensed under Apache-2.0.`
}
