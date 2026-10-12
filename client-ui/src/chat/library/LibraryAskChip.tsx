import { useSyncExternalStore } from 'react'
import { makeStyles } from '@fluentui/react-components'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import {
  disarmLibraryAsk,
  getLibraryAskSnapshot,
  subscribeLibraryAsk,
} from './libraryAsk'

const useStyles = makeStyles({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    margin: '0 0 8px',
    padding: '6px 10px',
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: opptrixCssVars.accentSoft,
    color: opptrixCssVars.textPrimary,
    fontSize: 'var(--opptrix-font-sm)',
  },
  dismiss: {
    border: 'none',
    background: 'transparent',
    color: opptrixCssVars.textSecondary,
    cursor: 'pointer',
    fontSize: 'var(--opptrix-font-sm)',
    padding: '2px 4px',
  },
})

/** 发送前可取消：这一轮只根据已加入的资料回答。 */
export default function LibraryAskChip() {
  const armed = useSyncExternalStore(subscribeLibraryAsk, getLibraryAskSnapshot, getLibraryAskSnapshot)
  const s = useStyles()
  if (!armed) return null
  return (
    <div className={s.row}>
      <span>这次只根据我的资料</span>
      <button type="button" className={s.dismiss} onClick={disarmLibraryAsk} aria-label="取消只根据资料回答">
        取消
      </button>
    </div>
  )
}
