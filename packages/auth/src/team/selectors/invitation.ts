import { type Base58 } from '@localfirst/crdx'
import { type TeamState } from '../types.js'
import { assert } from '@localfirst/shared'

export function hasInvitation(state: TeamState, id: Base58): boolean {
  return id in state.invitations
}

export function getInvitation(state: TeamState, id: Base58) {
  assert(hasInvitation(state, id), `No invitation with id '${id}' found.`)
  const invitation = state.invitations[id]
  return invitation
}
