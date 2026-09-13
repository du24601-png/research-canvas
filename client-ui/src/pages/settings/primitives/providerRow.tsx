import {
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent,
  Text, makeStyles, mergeClasses,
} from '@fluentui/react-components'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { opptrixTokens, opptrixCssVars } from '../../../theme/tokens'
import { designTokens } from '../../../theme/design-tokens'
import { motion } from '../../../theme/mixins'

const useStyles = makeStyles({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: designTokens.SPACING.xxl + 'px',
    padding: '12px 14px',
    minHeight: '42px',
    '@media (max-width: 660px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '8px',
      padding: '12px 14px',
    },
  },
  rowTopBorder: {
    borderTop: `1px solid ${opptrixCssVars.separator}`,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  rowTitle: {
    fontSize: 'var(--opptrix-font-base)',
    fontWeight: 400,
    color: opptrixCssVars.textPrimary,
    lineHeight: '18px',
  },
  rowDesc: {
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textSecondary,
    lineHeight: '18px',
  },
  rowControl: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    width: '100%',
    '@media (min-width: 661px)': {
      width: 'auto',
    },
  },
  rowActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  providerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
  },
  providerAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: opptrixCssVars.gray200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--opptrix-font-base)',
    fontWeight: 600,
    color: opptrixCssVars.textSecondary,
    flexShrink: 0,
  },
  /** 可点的「N 个模型」副标题 — 打开模型列表 Dialog */
  modelCountTrigger: {
    alignSelf: 'flex-start',
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textSecondary,
    lineHeight: '18px',
    textAlign: 'left',
    transitionProperty: 'color',
    transitionDuration: motion.fast,
    transitionTimingFunction: motion.ease,
    ':hover': {
      color: opptrixCssVars.textPrimary,
      textDecoration: 'underline',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transitionProperty: 'none',
    },
  },
  modelsDialogSurface: {
    maxWidth: '400px',
    width: 'calc(100vw - 40px)',
  },
  modelsDialogTitle: {
    fontSize: 'var(--opptrix-font-2xl)',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: opptrixCssVars.textPrimary,
  },
  modelsDialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '2px',
  },
  modelPopoverTitle: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 400,
    color: opptrixCssVars.textSecondary,
    lineHeight: '16px',
  },
  modelPopoverList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: 'min(50vh, 320px)',
    overflowY: 'auto',
  },
  modelPopoverItem: {
    fontSize: 'var(--opptrix-font-base)',
    fontFamily: 'var(--opptrix-font-mono)',
    color: opptrixCssVars.textPrimary,
    lineHeight: 1.45,
  },
})

/**
 * 大模型提供商行 — 头像 + 名称 + 模型数副标题；右侧仅编辑/删除。
 * 有模型时副标题可点，打开已启用模型列表 Dialog；不展示 baseUrl。
 */
export function SettingsProviderRow({
  name,
  models,
  avatar,
  action,
  first = false,
}: {
  name: string
  /** 可选；不再渲染（兼容旧调用方） */
  baseUrl?: string
  models: string[]
  avatar: string
  action?: ReactNode
  first?: boolean
}) {
  const s = useStyles()
  const [modelsOpen, setModelsOpen] = useState(false)
  const hasModels = models.length > 0
  const modelLabel = hasModels ? `${models.length} 个模型` : '尚未添加模型'

  return (
    <div className={mergeClasses(s.row, !first && s.rowTopBorder)}>
      <div className={s.rowMain}>
        <div className={s.providerRow}>
          <div className={s.providerAvatar}>{avatar}</div>
          <div className={s.rowMain}>
            <Text className={s.rowTitle} block>{name}</Text>
            {hasModels ? (
              <button
                type="button"
                className={mergeClasses(s.modelCountTrigger, 'opptrix-focusable')}
                onClick={() => setModelsOpen(true)}
                aria-label={`查看 ${name} 的模型`}
              >
                {modelLabel}
              </button>
            ) : (
              <Text className={s.rowDesc} block>{modelLabel}</Text>
            )}
          </div>
        </div>
      </div>
      <div className={s.rowControl}>
        <div className={s.rowActions}>
          {action}
        </div>
      </div>
      <Dialog open={modelsOpen} onOpenChange={(_, data) => setModelsOpen(data.open)}>
        <DialogSurface className={mergeClasses(s.modelsDialogSurface, 'opptrix-dialog-surface')}>
          <DialogBody>
            <DialogTitle className={s.modelsDialogTitle}>{name}</DialogTitle>
            <DialogContent className={s.modelsDialogContent}>
              <Text className={s.modelPopoverTitle} block>
                已启用模型 · {models.length}
              </Text>
              <div className={mergeClasses(s.modelPopoverList, 'opptrix-scroll')}>
                {models.map(m => (
                  <span key={m} className={s.modelPopoverItem}>{m}</span>
                ))}
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
