import { type KeysetWithSecrets, createKeyring, type KeyScope } from '@localfirst/crdx'
import { type TeamState } from '../types.js'
import { keyMap } from './keyMap.js'

/**
 * Returns a keyring containing all generations of keys for the given scope.
 */

export const keyring = (state: TeamState, scope: KeyScope, keys: KeysetWithSecrets) => {
  const foo = keyMap(state, keys)
  const allKeys = foo[scope.type]?.[scope.name]
  return createKeyring(allKeys)
}
