import { opptrixTokensDark, opptrixTokensLight, type ColorScheme } from '../../theme/tokens'

export interface ResearchChartTheme {
  text: string
  textSecondary: string
  border: string
  surface: string
  series: string[]
  up: string
  down: string
}

export function getResearchChartTheme(scheme: ColorScheme): ResearchChartTheme {
  const tokens = scheme === 'dark' ? opptrixTokensDark : opptrixTokensLight
  return {
    text: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    border: tokens.borderStrong,
    surface: tokens.surface,
    series: [
      tokens.accent,
      tokens.success,
      tokens.warning,
      '#5E9FD8',
      '#A56EFF',
      tokens.error,
      '#0D9488',
      '#DB2777',
    ],
    up: tokens.error,
    down: tokens.success,
  }
}
