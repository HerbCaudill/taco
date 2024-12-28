import { redactKeys } from '@localfirst/crdx'
import { type DeviceWithSecrets, type Device } from './types.js'

export const redactDevice = (device: DeviceWithSecrets): Device => ({
  ...device,
  keys: redactKeys(device.keys),
})
