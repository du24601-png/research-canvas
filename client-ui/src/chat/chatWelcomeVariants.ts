export interface ChatWelcomeVariant {
  title: string
  subtitle: string
  starters: string[]
}

export const CHAT_WELCOME_VARIANTS: ChatWelcomeVariant[] = [
  {
    title: '想研究什么？',
    subtitle: '我是 FinFrame。输入公司、指标或研究问题，我会先取数生成图表，每个数字都能点开看来源。',
    starters: [
      '对比宁德时代和比亚迪近五年毛利率',
      '看一下贵州茅台的净资产收益率走势',
      '比较几家银行龙头的净息差',
    ],
  },
]

export function pickWelcomeVariant(epoch: number): ChatWelcomeVariant {
  const list = CHAT_WELCOME_VARIANTS
  const index = ((epoch % list.length) + list.length) % list.length
  return list[index]!
}
