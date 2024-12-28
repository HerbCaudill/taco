import { type KeysetWithSecrets } from '@localfirst/crdx'
import { open } from '../../lockbox/index.js'
import { type TeamState } from '../types.js'

/**
 * Returns all keys that can be accessed directly or indirectly (via lockboxes) by the given keyset
 * @param state
 * @param keyset
 */
export const visibleKeys = (state: TeamState, keyset: KeysetWithSecrets): KeysetWithSecrets[] => {
  const { lockboxes } = state
  const { publicKey } = keyset.encryption

  // What lockboxes can I open with these keys?
  const lockboxesICanOpen = lockboxes.filter(({ recipient }) => recipient.publicKey === publicKey)

  // Collect all the keys from those lockboxes
  const keysets = lockboxesICanOpen.map(lockbox => open(lockbox, keyset))

  // Recursively get all the keys *those* keys can access
  const keys = keysets.flatMap(keyset => visibleKeys(state, keyset))

  return [...keysets, ...keys]
}
