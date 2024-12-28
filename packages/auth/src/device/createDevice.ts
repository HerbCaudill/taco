import { createKeyset, type UnixTimestamp } from '@localfirst/crdx'
import { createId } from '@paralleldrive/cuid2'
import { randomKey } from '@localfirst/crypto'
import type { DeviceWithSecrets } from './types.js'
import { KeyType } from '../util/index.js'

export const createDevice = ({
  userId,
  deviceName,
  deviceInfo = {},
  created = Date.now() as UnixTimestamp,
  seed = randomKey(),
}: Params): DeviceWithSecrets => {
  const deviceId = createId()
  const keys = createKeyset({ type: KeyType.DEVICE, name: deviceId }, seed)
  return { userId, deviceId, deviceName, keys, created, deviceInfo }
}

type Params = {
  userId: string
  deviceName: string
  deviceInfo?: any
  created?: UnixTimestamp
  seed?: string
}
