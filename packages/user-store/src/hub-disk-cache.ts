import {
  readMarketDynamicsCache,
  writeMarketDynamicsCache,
} from './market-dynamics-cache.js'
import {
  readInstrumentQuotesCache,
  readPortfolioSummaryCache,
  writeInstrumentQuotesFromResult,
  writePortfolioSummaryCache,
} from './panel-cache.js'

/** SQLite-backed Hub disk cache. Wire into `new ResearchHub({ diskCache })`. */
export function createHubDiskCache() {
  return {
    readMarketDynamicsCache,
    writeMarketDynamicsCache,
    readPortfolioSummaryCache,
    writePortfolioSummaryCache,
    readInstrumentQuotesCache,
    writeInstrumentQuotesFromResult,
  }
}
