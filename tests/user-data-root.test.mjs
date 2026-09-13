/**
 * User data root: ~/.research-canvas default, ~/.opptrix legacy read, env overrides.
 */
import { describe, it, before, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** @type {typeof import('../packages/shared/dist/paths.js')} */
let paths

describe('resolveUserDataRoot', () => {
  /** @type {Map<string, string | undefined>} */
  let savedEnv

  before(async () => {
    paths = await import('../packages/shared/dist/paths.js')
  })

  afterEach(() => {
    if (savedEnv) {
      for (const [key, value] of savedEnv) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      savedEnv = undefined
    }
  })

  it('RESEARCH_CANVAS_DATA_DIR overrides default home layout', () => {
    savedEnv = new Map([
      ['RESEARCH_CANVAS_DATA_DIR', process.env.RESEARCH_CANVAS_DATA_DIR],
      ['OPPTRIX_DATA_DIR', process.env.OPPTRIX_DATA_DIR],
    ])
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-data-'))
    process.env.RESEARCH_CANVAS_DATA_DIR = dir
    delete process.env.OPPTRIX_DATA_DIR
    assert.equal(paths.resolveUserDataRoot(), path.resolve(dir))
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('OPPTRIX_DATA_DIR still works when RESEARCH_CANVAS_DATA_DIR unset', () => {
    savedEnv = new Map([
      ['RESEARCH_CANVAS_DATA_DIR', process.env.RESEARCH_CANVAS_DATA_DIR],
      ['OPPTRIX_DATA_DIR', process.env.OPPTRIX_DATA_DIR],
    ])
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-legacy-env-'))
    delete process.env.RESEARCH_CANVAS_DATA_DIR
    process.env.OPPTRIX_DATA_DIR = dir
    assert.equal(paths.resolveUserDataRoot(), path.resolve(dir))
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('RESEARCH_CANVAS_DATA_DIR wins over OPPTRIX_DATA_DIR', () => {
    savedEnv = new Map([
      ['RESEARCH_CANVAS_DATA_DIR', process.env.RESEARCH_CANVAS_DATA_DIR],
      ['OPPTRIX_DATA_DIR', process.env.OPPTRIX_DATA_DIR],
    ])
    const primary = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-primary-'))
    const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-legacy-'))
    process.env.RESEARCH_CANVAS_DATA_DIR = primary
    process.env.OPPTRIX_DATA_DIR = legacy
    assert.equal(paths.resolveUserDataRoot(), path.resolve(primary))
    fs.rmSync(primary, { recursive: true, force: true })
    fs.rmSync(legacy, { recursive: true, force: true })
  })

  it('prefers legacy ~/.opptrix when present and no env override', () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-fake-home-'))
    savedEnv = new Map([
      ['HOME', process.env.HOME],
      ['USERPROFILE', process.env.USERPROFILE],
      ['RESEARCH_CANVAS_DATA_DIR', process.env.RESEARCH_CANVAS_DATA_DIR],
      ['OPPTRIX_DATA_DIR', process.env.OPPTRIX_DATA_DIR],
    ])
    process.env.HOME = fakeHome
    process.env.USERPROFILE = fakeHome
    delete process.env.RESEARCH_CANVAS_DATA_DIR
    delete process.env.OPPTRIX_DATA_DIR
    fs.mkdirSync(path.join(fakeHome, '.opptrix'))
    assert.equal(
      paths.resolveUserDataRoot(),
      path.join(fakeHome, '.opptrix'),
    )
    fs.rmSync(fakeHome, { recursive: true, force: true })
  })

  it('defaults to ~/.research-canvas on fresh install', () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-fresh-home-'))
    savedEnv = new Map([
      ['HOME', process.env.HOME],
      ['USERPROFILE', process.env.USERPROFILE],
      ['RESEARCH_CANVAS_DATA_DIR', process.env.RESEARCH_CANVAS_DATA_DIR],
      ['OPPTRIX_DATA_DIR', process.env.OPPTRIX_DATA_DIR],
    ])
    process.env.HOME = fakeHome
    process.env.USERPROFILE = fakeHome
    delete process.env.RESEARCH_CANVAS_DATA_DIR
    delete process.env.OPPTRIX_DATA_DIR
    assert.equal(
      paths.resolveUserDataRoot(),
      path.join(fakeHome, '.research-canvas'),
    )
    fs.rmSync(fakeHome, { recursive: true, force: true })
  })

  it('uses ~/.research-canvas when only new root exists', () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-new-only-'))
    savedEnv = new Map([
      ['HOME', process.env.HOME],
      ['USERPROFILE', process.env.USERPROFILE],
      ['RESEARCH_CANVAS_DATA_DIR', process.env.RESEARCH_CANVAS_DATA_DIR],
      ['OPPTRIX_DATA_DIR', process.env.OPPTRIX_DATA_DIR],
    ])
    process.env.HOME = fakeHome
    process.env.USERPROFILE = fakeHome
    delete process.env.RESEARCH_CANVAS_DATA_DIR
    delete process.env.OPPTRIX_DATA_DIR
    fs.mkdirSync(path.join(fakeHome, '.research-canvas'))
    assert.equal(
      paths.resolveUserDataRoot(),
      path.join(fakeHome, '.research-canvas'),
    )
    fs.rmSync(fakeHome, { recursive: true, force: true })
  })
})

describe('cache legacy import guard', () => {
  it('RESEARCH_CANVAS_DATA_DIR disables aaashare import', async () => {
    const prevRc = process.env.RESEARCH_CANVAS_DATA_DIR
    const prevOp = process.env.OPPTRIX_DATA_DIR
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-cache-env-'))
    process.env.RESEARCH_CANVAS_DATA_DIR = dir
    delete process.env.OPPTRIX_DATA_DIR
    try {
      const { shouldImportLegacyCache } = await import(
        '../packages/market-data-core/dist/core/cache-default-path.js'
      )
      assert.equal(shouldImportLegacyCache(path.join(dir, 'cache.json')), false)
    } finally {
      if (prevRc === undefined) delete process.env.RESEARCH_CANVAS_DATA_DIR
      else process.env.RESEARCH_CANVAS_DATA_DIR = prevRc
      if (prevOp === undefined) delete process.env.OPPTRIX_DATA_DIR
      else process.env.OPPTRIX_DATA_DIR = prevOp
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
