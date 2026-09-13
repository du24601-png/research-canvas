import { useCallback, useEffect, useState } from 'react'
import { Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import { setupOwnerAccount } from '../api/auth'
import {
  AuthFieldStack,
  AuthPasswordField,
  AuthUsernameField,
} from '../auth/AuthFields'
import { formatAuthError, validateOwnerCredentials } from '../auth/authErrors'
import { opptrixCssVars } from '../theme/tokens'
import { AccountSecurityBenefits } from '../pages/settings/AccountSecurityStepChrome'
import { ONBOARDING_COPY } from './manifest'
import { useOnboardingShellStyles } from './OnboardingShell'

export type OnboardingAccountNavState = {
  canAdvance: boolean
  advancing: boolean
  advanceLabel: string
  advance: () => Promise<void>
}

const useStyles = makeStyles({
  accountTitle: {
    marginTop: '15px',
    marginBottom: '10px',
  },
  accountLead: {
    marginTop: '0',
    marginBottom: '14px',
    fontSize: 'clamp(15px, 2vw, 17px)',
    color: opptrixCssVars.textSecondary,
    lineHeight: 1.7,
  },
  accountBenefits: {
    marginBottom: '16px',
  },
})

export function OnboardingAccountPanel({
  onCreated,
  onNavChange,
}: {
  onCreated: () => void
  onNavChange: (nav: OnboardingAccountNavState | null) => void
}) {
  const shell = useOnboardingShellStyles()
  const styles = useStyles()
  const copy = ONBOARDING_COPY.account

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState('')

  const advance = useCallback(async () => {
    const invalid = validateOwnerCredentials(username, password, confirm)
    if (invalid) {
      setError(invalid)
      return
    }
    setError('')
    setAdvancing(true)
    try {
      await setupOwnerAccount(username.trim(), password)
      onCreated()
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setAdvancing(false)
    }
  }, [username, password, confirm, onCreated])

  useEffect(() => {
    const canAdvance = validateOwnerCredentials(username, password, confirm) == null && !advancing
    onNavChange({
      canAdvance,
      advancing,
      advanceLabel: advancing ? '正在创建…' : '创建账户',
      advance,
    })
    return () => onNavChange(null)
  }, [username, password, confirm, advancing, advance, onNavChange])

  return (
    <>
      <Text className={mergeClasses(shell.sectionTitle, styles.accountTitle)} block>
        {copy.title}
      </Text>
      <Text className={styles.accountLead} block>
        {copy.desc}
      </Text>
      <div className={styles.accountBenefits}>
        <AccountSecurityBenefits
          items={[
            {
              title: '保护研究数据与密钥',
              desc: '创建后，进入工作台需要登录，避免他人直接打开这台部署。',
            },
            {
              title: '两步验证可稍后开启',
              desc: '需要时，可在设置的账户与安全中自行添加身份验证器。',
            },
          ]}
        />
      </div>
      <AuthFieldStack>
        <AuthUsernameField
          value={username}
          onChange={setUsername}
          disabled={advancing}
          autoComplete="username"
          showRules
        />
        <AuthPasswordField
          label="密码"
          value={password}
          onChange={setPassword}
          disabled={advancing}
          autoComplete="new-password"
          mode="create"
        />
        <AuthPasswordField
          label="确认密码"
          value={confirm}
          onChange={setConfirm}
          disabled={advancing}
          autoComplete="new-password"
          mode="confirm"
          matchAgainst={password}
        />
      </AuthFieldStack>
      {error ? (
        <Text className={shell.error} block role="alert">{error}</Text>
      ) : null}
    </>
  )
}
