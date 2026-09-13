import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dataDir = ''

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'opptrix-free-throttle-'))
  process.env.OPPTRIX_DATA_DIR = dataDir
})

after(async () => {
  const { getUserDataStore } = await import('../packages/user-store/dist/index.js')
  const { resetFreeProviderThrottleSingleton } = await import('../packages/a-stock-layer/dist/core/free-provider-throttle.js')
  getUserDataStore().close()
  resetFreeProviderThrottleSingleton()
  if (dataDir) await rm(dataDir, { recursive: true, force: true })
})

const PROBE_A = 'throttle-probe-a'
const PROBE_B = 'throttle-probe-b'

/** 合成免费源（无 Key manifest）：仅测限流持久化，不走生产 registerAllDrivers */
async function registerProbeFreeManifests() {
  const { getManifestRegistry } = await import('../packages/a-stock-layer/dist/providers/manifest-registry.js')
  const registry = getManifestRegistry()
  for (const id of [PROBE_A, PROBE_B]) {
    registry.register({
      providerId: id,
      title: id,
      marketGroup: 'CN',
      defaultPriority: 100,
      settings: { providerId: id, title: id, marketGroup: 'CN', fields: [] },
    }, 'installed')
  }
}

describe('free provider throttle persistence', () => {
  it('escalates cooldown on trigger and resets on success', async () => {
    const { MarketDataEngine } = await import('../packages/a-stock-layer/dist/engine.js')
    const { getFreeProviderThrottle, resetFreeProviderThrottleSingleton } = await import('../packages/a-stock-layer/dist/core/free-provider-throttle.js')
    const engine = new MarketDataEngine(false)
    engine.providerLoader.registerBuiltins()
    await registerProbeFreeManifests()
    resetFreeProviderThrottleSingleton()
    const throttle = getFreeProviderThrottle()

    const first = throttle.recordTrigger(PROBE_A, 'HTTP 429')
    assert.ok(first)
    assert.equal(first.escalationLevel, 1)
    assert.ok(throttle.shouldSkip(PROBE_A).skip)

    throttle.recordSuccess(PROBE_A)
    assert.equal(throttle.shouldSkip(PROBE_A).skip, false)
    const state = throttle.getState(PROBE_A)
    assert.equal(state?.escalationLevel, 0)
    assert.equal(state?.cooldownUntil, 0)
  })

  it('keeps logs across repository reload', async () => {
    const { MarketDataEngine } = await import('../packages/a-stock-layer/dist/engine.js')
    const { getUserDataStore } = await import('../packages/user-store/dist/index.js')
    const { getFreeProviderThrottle, resetFreeProviderThrottleSingleton } = await import('../packages/a-stock-layer/dist/core/free-provider-throttle.js')
    const { FREE_PROVIDER_EMPTY_BODY_REASON } = await import('@opptrix/shared')
    const engine = new MarketDataEngine(false)
    engine.providerLoader.registerBuiltins()
    await registerProbeFreeManifests()
    resetFreeProviderThrottleSingleton()
    const throttle = getFreeProviderThrottle()
    throttle.recordTrigger(PROBE_B, FREE_PROVIDER_EMPTY_BODY_REASON)
    const logsBefore = throttle.listLogs(PROBE_B, 5)
    assert.ok(logsBefore.length >= 1)

    getUserDataStore().close()
    resetFreeProviderThrottleSingleton()
    await registerProbeFreeManifests()
    const throttle2 = getFreeProviderThrottle()
    const state = throttle2.getState(PROBE_B)
    assert.ok(state && state.escalationLevel >= 1)
    const logsAfter = throttle2.listLogs(PROBE_B, 5)
    assert.ok(logsAfter.length >= 1)
  })
})
