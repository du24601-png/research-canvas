import type { ReactNode } from 'react'
import { Spinner, Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import { EditRegular } from '@fluentui/react-icons'
import { MARKET_DOWN, MARKET_UP, opptrixTokens, opptrixCssVars } from '../theme/tokens'
import { ghostInteractive } from '../theme/mixins'
const DETAIL_PANEL_CHART_MAX_HEIGHT_PX = 360

/**
 * DetailTabShell — 行情详情 Tab 的 L3 分子骨架（业务中性：纯布局 + 状态机，零取数）。
 *
 * 状态优先级：emptyMessage（未选择标的）→ loading（首载 Spinner，可带骨架头部）→
 * errorMessage（首载失败且无数据）→ fallbackMessage（缺数据兜底）→ 正常态 header + children。
 * 各域 Tab 只需提供「状态入参 + 头部/内容 slot」，取数与业务转换留在各自组件。
 */
const CONTENT_PAD = '15px'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
  },
  hero: {
    flexShrink: 0,
    padding: `6px ${CONTENT_PAD} 5px`,
    borderBottom: `1px solid ${opptrixCssVars.separator}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    minWidth: 0,
  },
  titleMain: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    minWidth: 0,
    overflow: 'hidden',
  },
  name: {
    fontSize: 'var(--opptrix-font-lg)',
    fontWeight: 650,
    letterSpacing: '-0.02em',
    color: opptrixCssVars.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  code: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    flexShrink: 0,
  },
  badge: {
    fontSize: 'var(--opptrix-font-xs)',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: opptrixTokens.radiusFull,
    backgroundColor: opptrixCssVars.accentSoft,
    color: opptrixCssVars.textSecondary,
    flexShrink: 0,
  },
  quoteMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  /** 标题行下方独立行情行（如 ETF：价格/涨跌 单独一行，可换行） */
  quoteRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  manageBtn: {
    ...ghostInteractive,
    border: `1px solid ${opptrixCssVars.separator}`,
    backgroundColor: opptrixCssVars.canvasAlt,
    color: opptrixCssVars.textSecondary,
    borderRadius: opptrixTokens.radiusSm,
    fontSize: 'var(--opptrix-font-xs)',
    fontWeight: 600,
    padding: '3px 7px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    lineHeight: 1.2,
  },
  price: {
    fontSize: 'var(--opptrix-font-3xl)',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1,
  },
  change: {
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  pct: {
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  pctUp: { color: MARKET_UP },
  pctDown: { color: MARKET_DOWN },
  pctFlat: { color: opptrixCssVars.textTertiary },
  heroGrid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '2px 6px',
  },
  /** 3 列堆叠网格（如 ETF 指标区） */
  heroGrid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '4px 8px',
    marginTop: '2px',
  },
  heroCell: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '4px',
    minWidth: 0,
  },
  heroLabel: {
    fontSize: 'var(--opptrix-font-xs)',
    color: opptrixCssVars.textTertiary,
    flexShrink: 0,
  },
  heroValue: {
    fontSize: 'var(--opptrix-font-sm)',
    fontWeight: 600,
    color: opptrixCssVars.textPrimary,
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  heroCellStacked: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: 0,
  },
  heroLabelStacked: {
    fontSize: 'var(--opptrix-font-xs)',
    color: opptrixCssVars.textTertiary,
  },
  heroValueStacked: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textPrimary,
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chartBody: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  chartPanel: {
    flexShrink: 0,
    minHeight: '200px',
    padding: `4px ${CONTENT_PAD} 8px`,
    overflow: 'hidden',
  },
  foot: {
    flexShrink: 0,
    padding: `0 ${CONTENT_PAD} 10px`,
    fontSize: 'var(--opptrix-font-xs)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.45,
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: opptrixCssVars.textTertiary,
    fontSize: 'var(--opptrix-font-md)',
  },
  error: {
    flexShrink: 0,
    padding: `0 ${CONTENT_PAD}`,
    fontSize: 'var(--opptrix-font-xs)',
    color: opptrixCssVars.error,
  },
})

/** 行情涨跌语气（与 market/format pctTone 对齐）：up 红涨 / down 绿跌 / flat 走平 */
export type DetailTabTone = 'up' | 'down' | 'flat'

export interface DetailTabHeroCellData {
  label: string
  value: string
  /** 长内容截断时的悬停完整文案 */
  title?: string
}

export interface DetailTabShellProps {
  /** 状态：未选择标的（优先级最高，纯居中文案） */
  emptyMessage?: string | null
  /** 状态：首次加载中（尚无数据） */
  loading?: boolean
  /** 加载中 Spinner 文案 */
  loadingLabel?: string
  /** 加载中的头部骨架（如仅标题行）；不传则只渲染居中 Spinner */
  loadingHeader?: ReactNode
  /** 状态：首载失败且无数据（纯居中文案） */
  errorMessage?: string | null
  /** 状态：非加载非错误的兜底缺数据（纯居中文案） */
  fallbackMessage?: string | null
  /** 正常态头部（DetailTabHero 等） */
  header?: ReactNode
  /** 主体内容（图表区 / 子页签 + 面板） */
  children?: ReactNode
}

/** 详情 Tab 状态骨架：空态 / 首载 / 错误 / 兜底 / 正常态五段式，居中态只读文案 */
export default function DetailTabShell({
  emptyMessage,
  loading = false,
  loadingLabel,
  loadingHeader,
  errorMessage,
  fallbackMessage,
  header,
  children,
}: DetailTabShellProps) {
  const s = useStyles()

  if (emptyMessage != null && emptyMessage !== '') {
    return <div className={s.center}>{emptyMessage}</div>
  }

  if (loading) {
    return (
      <div className={s.root}>
        {loadingHeader}
        <div className={s.center}>
          <Spinner size="small" label={loadingLabel} />
        </div>
      </div>
    )
  }

  if (errorMessage != null && errorMessage !== '') {
    return <div className={s.center}>{errorMessage}</div>
  }

  if (fallbackMessage != null && fallbackMessage !== '') {
    return <div className={s.center}>{fallbackMessage}</div>
  }

  return (
    <div className={s.root}>
      {header}
      {children}
    </div>
  )
}

export interface DetailTabHeroProps {
  /** 标的名称 */
  name: ReactNode
  /** 代码（名称右侧小字） */
  code?: ReactNode
  /** 标题行内徽标（持有、指数、会话标签等，紧跟代码） */
  titleBadges?: ReactNode
  /** 标题行右端元素（行情区 / 类型徽标 / 操作按钮） */
  titleTrailing?: ReactNode
  /** 标题行下方独立行情行（价格/涨跌单独一行的布局） */
  quoteRow?: ReactNode
  /** 标题行下提示/错误行（如基金首载失败仍保留头部的提示文案） */
  notice?: ReactNode
  /** 指标网格数据；不传则不渲染网格 */
  cells?: DetailTabHeroCellData[]
  /** 指标网格列数（默认 4） */
  columns?: 3 | 4
  /** 指标单元格排布：row=横排两端对齐（默认）；stacked=上下堆叠 */
  cellVariant?: 'row' | 'stacked'
}

/** 详情头部：标题行（名称/代码/徽标/行情）+ 可选提示行 + 指标网格 */
export function DetailTabHero({
  name,
  code,
  titleBadges,
  titleTrailing,
  quoteRow,
  notice,
  cells,
  columns = 4,
  cellVariant = 'row',
}: DetailTabHeroProps) {
  const s = useStyles()
  const stacked = cellVariant === 'stacked'
  return (
    <div className={s.hero}>
      <div className={s.titleRow}>
        <div className={s.titleMain}>
          <span className={s.name}>{name}</span>
          {code ? <span className={s.code}>{code}</span> : null}
          {titleBadges}
        </div>
        {titleTrailing ? <div className={s.quoteMain}>{titleTrailing}</div> : null}
      </div>
      {quoteRow ? <div className={s.quoteRow}>{quoteRow}</div> : null}
      {notice}
      {cells && cells.length > 0 ? (
        <div className={columns === 3 ? s.heroGrid3 : s.heroGrid4}>
          {cells.map(cell => (
            <div key={cell.label} className={stacked ? s.heroCellStacked : s.heroCell}>
              <span className={stacked ? s.heroLabelStacked : s.heroLabel}>{cell.label}</span>
              <span
                className={stacked ? s.heroValueStacked : s.heroValue}
                title={cell.title}
              >
                {cell.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** 详情头部标准徽标（类型/市场标签，如「ETF」「指数」「场内基金」） */
export function DetailTabBadge({ children }: { children: ReactNode }) {
  const s = useStyles()
  return <span className={s.badge}>{children}</span>
}

/** 行情价格/涨跌额/涨跌幅一组，统一应用涨跌语气色 */
export function DetailTabQuoteValues({
  tone,
  price,
  change,
  pct,
}: {
  tone: DetailTabTone
  price?: ReactNode
  change?: ReactNode
  pct?: ReactNode
}) {
  const s = useStyles()
  const toneCls = tone === 'up' ? s.pctUp : tone === 'down' ? s.pctDown : s.pctFlat
  return (
    <>
      {price != null && <span className={mergeClasses(s.price, toneCls)}>{price}</span>}
      {change != null && <span className={mergeClasses(s.change, toneCls)}>{change}</span>}
      {pct != null && <span className={mergeClasses(s.pct, toneCls)}>{pct}</span>}
    </>
  )
}

/** 「管理持仓」小按钮（详情头部右侧） */
export function DetailTabManageButton({
  label = '管理持仓',
  onClick,
}: {
  label?: string
  onClick: () => void
}) {
  const s = useStyles()
  return (
    <button type="button" className={s.manageBtn} onClick={onClick}>
      <EditRegular fontSize={12} />
      {label}
    </button>
  )
}

/** 详情页内联错误条（头部/子页签下方的非阻断刷新失败提示） */
export function DetailTabInlineError({ children }: { children: ReactNode }) {
  const s = useStyles()
  return <Text className={s.error}>{children}</Text>
}

/** 图表区骨架：图表面板 + 轮询刷新失败提示 + 脚注（现价详情/指数详情共用） */
export function DetailTabChartSection({
  chart,
  refreshError,
  footnote,
  maxHeight = DETAIL_PANEL_CHART_MAX_HEIGHT_PX,
}: {
  chart: ReactNode
  /** 轮询刷新失败时的错误文案（有数据时的非阻断提示） */
  refreshError?: string | null
  footnote?: ReactNode
  /** 图表面板最大高度（px，默认取详情面板图表配置） */
  maxHeight?: number
}) {
  const s = useStyles()
  return (
    <div className={s.chartBody}>
      <div className={s.chartPanel} style={{ maxHeight: `${maxHeight}px` }}>
        {chart}
      </div>
      {refreshError ? <Text className={s.error}>刷新失败：{refreshError}</Text> : null}
      {footnote ? <Text className={s.foot}>{footnote}</Text> : null}
    </div>
  )
}
