import { type UserWithSecrets } from '@localfirst/crdx'
import { type DeviceWithSecrets } from '../device/index.js'
import { type ServerWithSecrets } from '../server/index.js'

export type LocalContext = LocalUserContext | LocalServerContext

export type LocalUserContext = {
  user: UserWithSecrets
  device: DeviceWithSecrets
  client?: Client
}

export type LocalServerContext = {
  server: ServerWithSecrets
  client?: Client
}

export type Client = {
  name: string
  version: string
}
