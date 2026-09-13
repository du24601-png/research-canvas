import type { ProviderSettingsDefinition } from '@opptrix/shared'

export const TUSHARE_SETTINGS: ProviderSettingsDefinition = {
  providerId: 'tushare',
  title: 'Tushare Pro',
  subtitle: '专业 A 股基本面与行情',
  marketGroup: 'CN',
  keywords: ['tushare', 'token', '行情源', '数据密钥', '服务地址'],
  enableAffectsPriority: true,
  supportsTest: true,
  fields: [
    { key: 'enabled', type: 'boolean', label: '启用', default: false },
    {
      key: 'token',
      type: 'secret',
      label: '数据密钥',
      required: true,
      masked: true,
      placeholder: '粘贴 Tushare 数据密钥',
      description: '在 Tushare 官网获取后填入即可使用',
      helpUrl: 'https://tushare.pro/',
    },
    {
      key: 'httpUrl',
      type: 'string',
      label: '服务地址',
      required: false,
      placeholder: '一般无需填写',
      description: '仅在使用非官方数据服务时填写，留空即可',
    },
  ],
}
