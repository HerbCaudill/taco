import type { User, UserWithSecrets } from '@localfirst/crdx'
import type { Server, ServerWithSecrets } from './types.js'
import type { Device, DeviceWithSecrets } from '../device/index.js'
import type { Member } from '../team/index.js'

const toMember = (server: Server): Member => ({
  userId: server.host,
  userName: server.host,
  keys: server.keys,
  roles: [],
})

const toUser = <T extends Server | ServerWithSecrets>(server: T) =>
  ({
    userId: server.host,
    userName: server.host,
    keys: server.keys,
  }) as T extends Server ? User : UserWithSecrets

const toDevice = <T extends Server | ServerWithSecrets>(server: T) =>
  ({
    userId: server.host,
    deviceName: server.host,
    deviceId: server.host,
    keys: server.keys,
  }) as T extends Server ? Device : DeviceWithSecrets

export const castServer = { toMember, toUser, toDevice }
