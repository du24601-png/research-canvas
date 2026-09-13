import { useCallback, useEffect, useState } from 'react'
import { Switch, Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import OpptrixButton from '../../components/opptrix/OpptrixButton'
import { getHealth, getUserPreference, setUserPreference } from '../../api/client'
import { isElectron, type NotificationPermissionState } from '../../platform/detect'
import { opptrixCssVars } from '../../theme/tokens'
import { PRODUCT_BRAND } from '../../branding/productBrand'
import {
  SettingsGroup,
  SettingsRow,
} from './SettingsPrimitives'

/** 与 packages/shared chat-debug-settings 对齐；client-ui 不从 shared 主入口导入 */
const CHAT_DEBUG_LOGGING_KEY = 'chat_debug_logging'

function parseChatDebugEnabled(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return (value as { enabled?: unknown }).enabled === true
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  rootFlush: {
    gap: '16px',
  },
  prose: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '52ch',
    paddingTop: '4px',
  },
  proseFlush: {
    maxWidth: 'none',
  },
  lead: {
    fontSize: 'var(--opptrix-font-lg)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.65,
  },
  note: {
    fontSize: 'var(--opptrix-font-base)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.6,
  },
  sectionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionLabel: {
    fontSize: 'var(--opptrix-font-md)',
    fontWeight: 400,
    color: opptrixCssVars.textSecondary,
    lineHeight: '16px',
    paddingLeft: '2px',
  },
  notifyActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
})

type AboutSettingsSectionProps = {
  contentFlush?: boolean
}

export default function AboutSettingsSection({ contentFlush = false }: AboutSettingsSectionProps) {
  const s = useStyles()
  const [versionLabel, setVersionLabel] = useState<string | null>(null)
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermissionState | null>(null)
  const [chatDebugEnabled, setChatDebugEnabled] = useState(false)
  const [chatDebugLoading, setChatDebugLoading] = useState(true)

  useEffect(() => {
    if (isElectron()) {
      void window.electronAPI?.clientVersion?.().then(version => {
        setVersionLabel(version ? `v${version}` : null)
      })
      void window.electronAPI?.notificationGetPermission?.()
        .then(perm => setNotifyPermission(perm))
        .catch(() => setNotifyPermission(null))
      return
    }
    void getHealth()
      .then((health) => {
        const runtime = health.runtime_version || health.version
        if (!runtime) {
          setVersionLabel(null)
          return
        }
        const runtimeLabel = runtime.replace(/^v/i, '')
        const baseRaw = health.base_version?.trim()
        const baseLabel = baseRaw ? baseRaw.replace(/^v/i, '') : ''
        if (baseLabel && baseLabel !== runtimeLabel) {
          setVersionLabel(`运行时 v${runtimeLabel} · 底座 v${baseLabel}`)
        } else {
          setVersionLabel(`运行时 v${runtimeLabel}`)
        }
      })
      .catch(() => setVersionLabel(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    void getUserPreference<{ enabled?: boolean }>(CHAT_DEBUG_LOGGING_KEY)
      .then(resp => {
        if (!cancelled) setChatDebugEnabled(parseChatDebugEnabled(resp.value))
      })
      .catch(() => {
        if (!cancelled) setChatDebugEnabled(false)
      })
      .finally(() => {
        if (!cancelled) setChatDebugLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleOpenNotificationSettings = useCallback(() => {
    void window.electronAPI?.notificationOpenSettings?.()
  }, [])

  const handleRefreshNotificationPermission = useCallback(() => {
    void window.electronAPI?.notificationRequestPermission?.()
      .then(perm => setNotifyPermission(perm))
      .catch(() => {})
  }, [])

  const handleChatDebugChange = useCallback((_: unknown, data: { checked: boolean | 'mixed' }) => {
    const next = Boolean(data.checked)
    setChatDebugEnabled(next)
    void setUserPreference(CHAT_DEBUG_LOGGING_KEY, { enabled: next }).catch(() => {
      setChatDebugEnabled(!next)
    })
  }, [])

  const handleOpenChatDebugDir = useCallback(() => {
    void window.electronAPI?.chatDebugOpenLogDir?.().catch(() => {})
  }, [])

  const versionDesc = versionLabel ?? '读取版本中…'

  const notifyPermissionDesc = (() => {
    switch (notifyPermission) {
      case 'granted':
        return '已开启。对话完成或需要你确认时，会在你离开窗口时提醒你。'
      case 'denied':
        return '系统未允许通知。请在系统设置中开启，以免错过对话完成提醒。'
      case 'default':
        return '尚未确认。完成对话后若未收到提醒，请到系统设置中允许本应用发送通知。'
      default:
        return '正在读取通知状态…'
    }
  })()

  return (
    <div className={mergeClasses(s.root, contentFlush && s.rootFlush)}>
      <div className={mergeClasses(s.prose, contentFlush && s.proseFlush)}>
        <Text className={s.lead} block>
          {PRODUCT_BRAND.name} 是 AI 投研 Agent 与交互式数据分析画布。用日常中文提出研究问题，我会先生成数据视图供你确认，再整理成可读的分析。
        </Text>
        <Text className={s.note} block>
          本软件仅供学习与研究参考，不构成投资建议，也不能代替券商下单或自动交易。请自行核实信息并独立做出投资决策。
        </Text>
        <Text className={s.note} block>
          你的对话、关注列表和数据密钥等默认保存在本机，由你自行管理；使用哪家大模型、哪些数据源，可在设置中调整。
        </Text>
      </div>

      <div className={s.sectionBlock}>
        <Text className={s.sectionLabel} block>版本信息</Text>
        <SettingsGroup>
          <SettingsRow
            title="当前版本"
            desc={versionDesc}
            last
          />
        </SettingsGroup>
      </div>

      {isElectron() && (
        <div className={s.sectionBlock}>
          <Text className={s.sectionLabel} block>桌面通知</Text>
          <SettingsGroup>
            <SettingsRow
              title="系统通知"
              desc={notifyPermissionDesc}
              control={(
                <div className={s.notifyActions}>
                  {notifyPermission === 'denied' || notifyPermission === 'default' ? (
                    <OpptrixButton variant="secondary" onClick={handleOpenNotificationSettings}>
                      打开系统设置
                    </OpptrixButton>
                  ) : (
                    <OpptrixButton variant="secondary" onClick={handleRefreshNotificationPermission}>
                      刷新状态
                    </OpptrixButton>
                  )}
                </div>
              )}
              last
            />
          </SettingsGroup>
        </div>
      )}

      <div className={s.sectionBlock}>
        <Text className={s.sectionLabel} block>对话调试日志</Text>
        <SettingsGroup>
          <SettingsRow
            title="对话调试日志"
            desc="开启后，将把对话过程写入本机日志，便于排查无回复或中断；默认关闭"
            control={(
              <Switch
                checked={chatDebugEnabled}
                disabled={chatDebugLoading}
                onChange={handleChatDebugChange}
                aria-label="对话调试日志"
              />
            )}
            last={!isElectron()}
          />
          {isElectron() ? (
            <SettingsRow
              title="日志文件夹"
              desc="在系统文件管理器中打开本机日志目录"
              control={(
                <OpptrixButton variant="secondary" onClick={handleOpenChatDebugDir}>
                  打开日志文件夹
                </OpptrixButton>
              )}
              last
            />
          ) : null}
        </SettingsGroup>
      </div>
    </div>
  )
}
