import { getLatestGeneration, type Keyring, type UserWithSecrets } from '@localfirst/crdx'
import { assert } from '@localfirst/shared'
import { generateProof } from '../invitation/generateProof.js'
import { generateStarterKeys } from '../invitation/generateStarterKeys.js'
import { KeyType } from '../util/index.js'
import { getTeamState } from '../team/getTeamState.js'
import * as select from '../team/selectors/index.js'

const { USER } = KeyType

/**
 * If we're joining as a new device for an existing member, we don't have a user object yet, so we
 * need to get those from the graph. We use the invitation seed to generate the starter keys for the
 * new device. We can use these to unlock the lockboxes on the team graph that contain our user
 * keys.
 *
 * Because we need all previous user keys to decrypt the team graph, we return a keyring containing
 * the full history of user keys, along with a user object containing just the latest generation of
 * keys.
 */
export const getDeviceUserFromGraph = ({
  serializedGraph,
  teamKeyring,
  invitationSeed,
}: {
  serializedGraph: Uint8Array
  teamKeyring: Keyring
  invitationSeed: string
}): {
  user: UserWithSecrets
  userKeyring: Keyring
} => {
  const starterKeys = generateStarterKeys(invitationSeed)
  const invitationId = generateProof(invitationSeed).id
  const state = getTeamState(serializedGraph, teamKeyring)

  const { userId } = select.getInvitation(state, invitationId)
  assert(userId) // since this is a device invitation the invitation info includes the userId that created it

  const { userName } = select.member(state, userId)
  assert(userName) // this user must exist in the team graph

  const userKeyring = select.keyring(state, { type: USER, name: userId }, starterKeys)
  const keys = getLatestGeneration(userKeyring)

  assert(keys, 'Failed to get device user from graph as there are no keys for user keyring')

  const user: UserWithSecrets = { userName, userId, keys }

  return { user, userKeyring }
}
