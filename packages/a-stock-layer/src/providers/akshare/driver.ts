import { applyManifestSpec } from '../common/driver-factory.js'
import { AKSHARE_SPEC } from './manifest.js'
import { AkshareHandler } from './handler.js'
import { isAkshareEnabled } from './settings.js'

export class AkshareDriver extends AkshareHandler {}

applyManifestSpec(AkshareDriver, AKSHARE_SPEC, { isRuntimeEnabled: isAkshareEnabled })
