import { createKeyset } from '@localfirst/crdx'
import { createId } from '@paralleldrive/cuid2'
import { randomKey } from '@localfirst/crypto'
import type { DeviceWithSecrets } from './types.js'
import { KeyType } from 'util/index.js'

export const createDevice = (
  userId: string,
  deviceName: string,
  seed: string = randomKey()
): DeviceWithSecrets => {
  const deviceId = createId()
  const keys = createKeyset({ type: KeyType.DEVICE, name: deviceId }, seed)
  return { userId, deviceId, deviceName, keys }
}
