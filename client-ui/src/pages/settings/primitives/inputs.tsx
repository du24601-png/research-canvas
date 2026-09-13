import { useEffect, useRef, useState } from 'react'
import { Input, Text, makeStyles, mergeClasses } from '@fluentui/react-components'
import { EyeRegular, EyeOffRegular, Wifi1Regular, CheckmarkRegular } from '@fluentui/react-icons'
import type { ReactNode } from 'react'
import { opptrixCssVars } from '../../../theme/tokens'
import { inputShellInteractive } from '../../../theme/mixins'
import OpptrixButton from '../../../components/opptrix/OpptrixButton'

const useStyles = makeStyles({
  inlineInput: {...inputShellInteractive,
    width: '100%',
    minWidth: '120px',
    maxWidth: '160px',
    minHeight: '30px',
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    '@media (max-width: 720px)': {
      maxWidth: 'none',
    },
  },
  inlineInputWide: {
    maxWidth: 'none',
    width: '100%',
  },
  credentialCombo: {...inputShellInteractive,
    width: '100%',
    minWidth: 0,
    minHeight: '30px',
    display: 'flex',
    alignItems: 'stretch',
    padding: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  credentialWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  credentialHint: {
    fontSize: 'var(--opptrix-font-sm)',
    color: opptrixCssVars.textTertiary,
    lineHeight: 1.45,
    paddingLeft: '2px',
  },
  credentialInput: {
    flex: '1 1 0',
    minWidth: 0,
    fontFamily: 'var(--opptrix-font-mono)',
    fontSize: 'var(--opptrix-font-md)',
    paddingLeft: '10px',
  },
  credentialSegment: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    borderLeft: `1px solid ${opptrixCssVars.separator}`,
  },
})

export function SettingsInlineInput({
  children,
  wide = false,
}: {
  children: ReactNode
  wide?: boolean
}) {
  const s = useStyles()
  return (
    <div className={mergeClasses(s.inlineInput, wide && s.inlineInputWide, 'opptrix-input-shell', 'opptrix-settings-inline-input')}>
      {children}
    </div>
  )
}

export function SettingsTextField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <SettingsInlineInput>
      <Input
        className="opptrix-settings-field-input"
        appearance="filled-darker"
        size="small"
        value={value}
        placeholder={placeholder}
        onChange={(_, d) => onChange(d.value ?? '')}
      />
    </SettingsInlineInput>
  )
}

export function SettingsCredentialRow({
  value,
  onChange,
  placeholder = '粘贴密钥',
  onTest,
  onSave,
  testing = false,
  saving = false,
  saveDisabled = false,
  testDisabled = false,
  revealWhenFilled = false,
  configured = false,
  preview,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onTest: () => void
  onSave: () => void
  testing?: boolean
  saving?: boolean
  saveDisabled?: boolean
  testDisabled?: boolean
  revealWhenFilled?: boolean
  configured?: boolean
  preview?: string
}) {
  const s = useStyles()
  const userToggledVisibility = useRef(false)
  const [visible, setVisible] = useState(false)
  const showConfiguredHint = configured && !value.trim()

  useEffect(() => {
    if (revealWhenFilled && value && !userToggledVisibility.current) {
      setVisible(true)
    }
  }, [value, revealWhenFilled])

  return (
    <div className={s.credentialWrap}>
      <div className={mergeClasses(s.credentialCombo, 'opptrix-input-shell', 'opptrix-settings-inline-input', 'opptrix-credential-combo')}>
        <Input
          className={mergeClasses(s.credentialInput, 'opptrix-settings-field-input')}
          appearance="filled-darker"
          size="small"
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(_, d) => onChange(d.value ?? '')}
        />
        <div className={s.credentialSegment}>
          <OpptrixButton
            variant="icon"
            aria-label={visible ? '隐藏密钥' : '显示密钥'}
            icon={visible ? <EyeOffRegular fontSize={14} /> : <EyeRegular fontSize={14} />}
            onClick={() => {
              userToggledVisibility.current = true
              setVisible(v => !v)
            }}
          />
        </div>
        <div className={s.credentialSegment}>
          <OpptrixButton
            variant="icon"
            aria-label="测试连接"
            icon={<Wifi1Regular fontSize={14} />}
            disabled={testing || testDisabled || saving}
            onClick={onTest}
          />
        </div>
        <div className={s.credentialSegment}>
          <OpptrixButton
            variant="icon"
            aria-label="保存"
            icon={<CheckmarkRegular fontSize={14} />}
            disabled={saving || saveDisabled}
            onClick={onSave}
          />
        </div>
      </div>
      {showConfiguredHint && (
        <Text className={s.credentialHint} block>
          {preview ? `当前密钥：${preview}。如需更换，输入新密钥后保存。` : '密钥已保存在本机，如需更换请输入新密钥后保存。'}
        </Text>
      )}
    </div>
  )
}
