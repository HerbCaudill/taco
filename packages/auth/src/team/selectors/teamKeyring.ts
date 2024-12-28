import { type KeysetWithSecrets } from '@localfirst/crdx'
import { type TeamState } from '../types.js'
import { KeyType } from '../../util/types.js'
import { keyring } from './keyring.js'

const { TEAM } = KeyType

export const teamKeyring = (state: TeamState, keys: KeysetWithSecrets) =>
  keyring(state, { type: TEAM, name: TEAM }, keys)
