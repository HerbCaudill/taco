import { type TeamState } from '../types.js'
import { assert } from '@localfirst/shared'
import { server } from './server.js'
import { hasServer } from './hasServer.js'
import { castServer } from '../../server/castServer.js'

export const hasDevice = (
  state: TeamState,
  deviceId: string,
  options = { includeRemoved: false }
) => {
  return getDevice(state, deviceId, options) !== undefined
}

export const device = (state: TeamState, deviceId: string, options = { includeRemoved: false }) => {
  const device = getDevice(state, deviceId, options)
  assert(device, `Device ${deviceId} not found`)
  return device
}

const getDevice = (state: TeamState, deviceId: string, options = { includeRemoved: false }) => {
  if (hasServer(state, deviceId)) {
    return castServer.toDevice(server(state, deviceId))
  }
  const members = state.members.concat(options.includeRemoved ? state.removedMembers : [])
  const allDevices = members.flatMap(m => m.devices ?? [])
  return (
    allDevices.find(d => d.deviceId === deviceId) ??
    (options.includeRemoved ? state.removedDevices.find(d => d.deviceId === deviceId) : undefined)
  )
}
