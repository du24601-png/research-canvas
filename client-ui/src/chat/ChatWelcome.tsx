import { Text } from '@fluentui/react-components'
import { WELCOME_NOTE } from './chatWelcomeVariants'

interface ChatWelcomeProps {
  title: string
  subtitle: string
  chatFirst: boolean
  starters: Array<{ label: string; text: string }>
  bannerClassName: string
  titleClassName: string
  subtitleClassName: string
  onPick: (text: string) => void
}

/** 欢迎页：标题 + 示例问题（纯文字行）+ 一行说明；示例与说明仅在对话优先布局出现。 */
export default function ChatWelcome({
  title, subtitle, chatFirst, starters, bannerClassName, titleClassName, subtitleClassName, onPick,
}: ChatWelcomeProps) {
  return (
    <div className={bannerClassName}>
      <Text className={titleClassName}>{title}</Text>
      {subtitle ? <Text className={subtitleClassName}>{subtitle}</Text> : null}
      {chatFirst ? (
        <>
          <div className="finframe-welcome-starters">
            {starters.map(st => (
              <button
                key={st.text}
                type="button"
                className="finframe-welcome-starter"
                onClick={() => onPick(st.text)}
              >
                {st.label}
              </button>
            ))}
          </div>
          <Text className="finframe-welcome-note">{WELCOME_NOTE}</Text>
        </>
      ) : null}
    </div>
  )
}
