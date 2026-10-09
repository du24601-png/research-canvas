/** 预览卡上「采纳」相关文案：对话优先布局叫「钉住 / 看板」，双栏布局保持原文案。 */
export interface AdoptLabels {
  adopt: string
  accepted: string
  locate: string
}

export function adoptLabels(chatFirst: boolean): AdoptLabels {
  return chatFirst
    ? { adopt: '钉住', accepted: '已钉住', locate: '在看板中查看' }
    : { adopt: '添加到画布', accepted: '已添加到画布', locate: '在画布中定位' }
}
