export const LIQUOR_UNIVERSE = ['贵州茅台', '五粮液', '洋河股份', '泸州老窖', '山西汾酒', '古井贡酒', '今世缘', '迎驾贡酒']
export const SEMI_UNIVERSE = ['中芯国际', '韦尔股份', '北方华创', '海光信息', '兆易创新', '士兰微', '澜起科技', '中微公司']

export function isRejectText(text) {
  return /先别|不要|不对|算了|拒绝|停/.test(String(text ?? ''))
}

export function universeEntities(industry) {
  const raw = String(industry ?? '')
  if (raw.includes('白酒')) return LIQUOR_UNIVERSE
  if (raw.includes('半导体')) return SEMI_UNIVERSE
  return LIQUOR_UNIVERSE
}

export function searchMatches(keyword) {
  const q = String(keyword ?? '').trim()
  const table = [
    ['中芯国际', { name: '中芯国际', symbol: '688981' }],
    ['688981', { name: '中芯国际', symbol: '688981' }],
    ['00981', { name: '中芯国际', symbol: '00981' }],
    ['美的', { name: '美的集团', symbol: '000333' }],
    ['格力', { name: '格力电器', symbol: '000651' }],
    ['海康', { name: '海康威视', symbol: '002415' }],
    ['五粮液', { name: '五粮液', symbol: '000858' }],
    ['茅台', { name: '贵州茅台', symbol: '600519' }],
    ['招商银行', { name: '招商银行', symbol: '600036' }],
  ]
  const hits = table.filter(([k]) => q.includes(k) || k.includes(q)).map(([, hit]) => hit)
  if (hits.length) return hits
  return q ? [{ name: q, symbol: q }] : []
}
