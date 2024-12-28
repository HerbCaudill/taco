import { type KeyScope } from '@localfirst/crdx'
import { type TeamState } from './types.js'
import { ADMIN } from '../role/index.js'
import { KeyType } from '../util/index.js'

export const ALL = 'ALL'

export const initialState: TeamState = {
  head: [],
  teamName: '',
  members: [],
  servers: [],
  roles: [],
  lockboxes: [],
  invitations: {},
  messages: [],
  removedMembers: [],
  removedDevices: [],
  removedServers: [],
  pendingKeyRotations: [],
}

export const TEAM_SCOPE = { type: KeyType.TEAM, name: KeyType.TEAM } as KeyScope
export const ADMIN_SCOPE = { type: KeyType.ROLE, name: ADMIN } as KeyScope
export const EPHEMERAL_SCOPE = {
  type: KeyType.EPHEMERAL,
  name: KeyType.EPHEMERAL,
} as KeyScope
