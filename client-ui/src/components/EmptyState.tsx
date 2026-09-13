import OpptrixEmptyState from './opptrix/OpptrixEmptyState'

/**
 * 归一至 L1 原子 OpptrixEmptyState（components/opptrix/OpptrixEmptyState.tsx）。
 * 本文件仅保留既有 `message` 单 props 签名作兼容出口；空态文案请遵循
 * 「为什么没有 + 下一步是什么」规范，优先直接使用 OpptrixEmptyState。
 */
interface Props {
  message: string
}

export default function EmptyState({ message }: Props) {
  return <OpptrixEmptyState title={message} />
}
