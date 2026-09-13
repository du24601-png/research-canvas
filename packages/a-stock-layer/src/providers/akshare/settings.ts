import type { ProviderSettingsDefinition } from '@opptrix/shared'
import { getUserDataStore } from '@opptrix/user-store'

export const AKSHARE_DISPLAY_TITLE = 'AKShare'
export const AKSHARE_DISPLAY_SUBTITLE = '开源 Python 财经库，A 股财务与 K 线'

export const AKSHARE_SETTINGS: ProviderSettingsDefinition = {
  providerId: 'akshare',
  title: AKSHARE_DISPLAY_TITLE,
  subtitle: AKSHARE_DISPLAY_SUBTITLE,
  marketGroup: 'CN',
  keywords: ['akshare', '开源', 'python', '财务', 'k线', '东财'],
  enableAffectsPriority: true,
  supportsTest: true,
  fields: [
    { key: 'enabled', type: 'boolean', label: '启用', default: false },
    {
      key: 'pythonPath',
      type: 'string',
      label: 'Python 路径（可选）',
      required: false,
      placeholder: '留空则自动检测系统 Python',
      description: '需已安装 akshare（pip install akshare）。若网络异常，请检查本机代理设置。',
      helpUrl: 'https://akshare.akfamily.xyz/',
    },
  ],
}

function runtimeRow() {
  return getUserDataStore().providerSettings.get('akshare')
}

/** 默认关闭；需在设置页手动开启 */
export function isAkshareEnabled(): boolean {
  return runtimeRow()?.enabled === true
}

/** 用户配置的 Python 可执行路径（可选） */
export function aksharePythonPathFromSettings(): string {
  return String(runtimeRow()?.extra?.pythonPath ?? '').trim()
}
