import { castServer } from '../../server/castServer.js'
import type { TeamState } from '../index.js'
import { member, device, server, hasServer } from './index.js'

export const memberByDeviceId = (
  state: TeamState,
  deviceId: string,
  options = { includeRemoved: false }
) => {
  if (hasServer(state, deviceId)) return castServer.toMember(server(state, deviceId))
  const { userId } = device(state, deviceId, options)
  return member(state, userId, options)
}
