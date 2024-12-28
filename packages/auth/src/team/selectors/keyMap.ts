import { type KeysetWithSecrets } from '@localfirst/crdx'
import { visibleKeys } from './visibleKeys.js'
import { type TeamState } from '../types.js'

/** Returns all keysets from the current device's lockboxes in a structure that looks like this:
 * ```js
 * {
 *    TEAM: {
 *      TEAM: [ gen0, gen1, gen2, ... ], // <- all keys starting with generation 0
 *    ROLE: {
 *      admin: [ gen0, ... ]
 *      managers: [ gen0, ...]
 *    },
 *   USER: {
 *    alice: [ gen0, ... ]
 *   }
 * }
 * ```
 */
export const keyMap = (state: TeamState, deviceKeys: KeysetWithSecrets): KeyMap => {
  // Get all the keys those keys can access
  const allVisibleKeys = visibleKeys(state, deviceKeys)

  // Structure these keys as described above
  return allVisibleKeys.reduce(organizeKeysIntoMap, {})
}

const organizeKeysIntoMap = (result: KeyMap, keys: KeysetWithSecrets) => {
  const { type, name, generation } = keys
  const keysetsForScope = result[type] ?? {}
  const keysetHistory = keysetsForScope[name] ?? []
  keysetHistory[generation] = keys
  return {
    ...result,
    [type]: {
      ...keysetsForScope,
      [name]: keysetHistory,
    },
  } as KeyMap
}

type KeyMap = Record<string, Record<string, KeysetWithSecrets[]>>
