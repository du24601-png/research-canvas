import { useEffect, useState } from 'react'
import { Spinner, makeStyles } from '@fluentui/react-components'
import { useAuthStatus } from '../../auth/AuthGate'
import { isAdminSessionRole } from '../../auth/roles'
import { CreateAccountCard } from './AccountSecurityCreateCard'
import { ChangePasswordCard } from './AccountSecurityPasswordCard'
import { RecoveryCodesBlock } from './AccountSecurityRecoveryCodes'
import { SessionsCard } from './AccountSecuritySessionsCard'
import { TotpSettingsCard } from './AccountSecurityTotpCard'
import {
  SettingsGroup,
  SettingsModeTabs,
  SettingsRow,
} from './SettingsPrimitives'
import { useSettingsToast } from './SettingsToast'
import { AccountSecurityStatusPills } from './AccountSecurityStepChrome'

type AccountSecurityTab = 'overview' | 'password' | 'totp' | 'sessions'

const TABS: Array<{ id: AccountSecurityTab; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'password', label: '密码' },
  { id: 'totp', label: '两步验证' },
  { id: 'sessions', label: '登录设备' },
]

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  headerMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: 0,
  },
})

export default function AccountSecuritySettingsSection() {
  const s = useStyles()
  const toast = useSettingsToast()
  const { status } = useAuthStatus()
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [tab, setTab] = useState<AccountSecurityTab>('overview')

  useEffect(() => {
    if (recoveryCodes && recoveryCodes.length > 0) setTab('totp')
  }, [recoveryCodes])

  if (!status) {
    return <Spinner size="small" label="正在加载账户信息…" />
  }

  if (!status.claimed) {
    if (status.setup_disabled) {
      return (
        <div className={s.root}>
          <SettingsGroup>
            <SettingsRow
              title="账户由部署预置"
              desc="请使用管理员或演示账户登录。此实例已关闭自助注册。"
              last
            />
          </SettingsGroup>
        </div>
      )
    }
    return (
      <div className={s.root}>
        <CreateAccountCard />
      </div>
    )
  }

  const isAdmin = isAdminSessionRole(status.role)
  const visibleTabs = isAdmin
    ? TABS
    : TABS.filter(item => item.id === 'overview' || item.id === 'password')

  const totpOn = Boolean(status.totp_enabled)
  const showingRecovery = Boolean(recoveryCodes && recoveryCodes.length > 0)

  return (
    <div className={s.root}>
      <div className={s.headerMeta}>
        <AccountSecurityStatusPills
          items={[
            {
              label: totpOn ? '两步验证已开启' : '两步验证未开启',
              tone: totpOn ? 'ok' : 'neutral',
            },
          ]}
        />
      </div>

      <SettingsModeTabs
        value={tab}
        onChange={setTab}
        items={visibleTabs}
        ariaLabel="账户与安全分类"
        wrap
      />

      <div className={s.panel} role="tabpanel">
        {showingRecovery ? (
          <RecoveryCodesBlock
            codes={recoveryCodes ?? []}
            onCopied={() => toast.showToast('恢复码已复制，请妥善保存', 'success')}
            onDownloaded={() => toast.showToast('备份文件已开始下载', 'success')}
            onDone={() => {
              setRecoveryCodes(null)
              setTab('totp')
            }}
          />
        ) : null}

        {!showingRecovery && tab === 'overview' ? (
          <SettingsGroup>
            <SettingsRow
              title="用户名"
              desc={status.username ?? '—'}
            />
            {status.role ? (
              <SettingsRow
                title="角色"
                desc={status.role === 'admin' ? '管理员' : '演示用户'}
                last={!isAdmin}
              />
            ) : null}
            {!isAdmin ? (
              <SettingsRow
                title="权限"
                desc="可对话、看板与发布；修改模型与数据源需管理员账户。"
                last
              />
            ) : null}
          </SettingsGroup>
        ) : null}

        {!showingRecovery && tab === 'password' ? (
          <ChangePasswordCard />
        ) : null}

        {!showingRecovery && isAdmin && tab === 'totp' ? (
          <TotpSettingsCard
            enabled={totpOn}
            onRecoveryCodes={setRecoveryCodes}
          />
        ) : null}

        {!showingRecovery && isAdmin && tab === 'sessions' ? (
          <SessionsCard currentSessionId={status.session?.id} compact />
        ) : null}
      </div>
    </div>
  )
}
