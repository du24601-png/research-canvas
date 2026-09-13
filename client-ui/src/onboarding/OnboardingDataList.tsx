import { Text } from '@fluentui/react-components'
import type { ProviderCatalogResponse } from '../types/provider'
import {
  ProviderCatalogLoading,
  useProviderCatalog,
} from '../pages/settings/ProviderSettingsCatalog'
import { DataProvidersCardsPanel } from '../pages/settings/DataProvidersCardsPanel'
import { opptrixCssVars } from '../theme/tokens'

export function OnboardingDataList() {
  const { catalog, loading, refresh } = useProviderCatalog()

  if (loading && !catalog) {
    return <ProviderCatalogLoading />
  }

  if (!catalog) {
    return (
      <Text block style={{ fontSize: 'var(--opptrix-font-base)', color: opptrixCssVars.textSecondary }}>
        暂时无法加载数据源列表，请稍后重试。
      </Text>
    )
  }

  return (
    <DataProvidersCardsPanel
      catalog={catalog}
      onSaved={() => { void refresh() }}
      showAdvancedOrder={false}
    />
  )
}
