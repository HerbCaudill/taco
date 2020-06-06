﻿import { Keys, KeyMetadata } from '/keys'
import { open } from '/lockbox'
import { TeamState } from '/team/types'
import { LocalUser } from '/user'
import { Optional } from '/lib'

export const keys = (
  state: TeamState,
  currentUser: LocalUser,
  scope: Optional<KeyMetadata, 'generation'>
) => {
  const { type, name, generation: generationOrUndefined } = scope

  const keysFromLockboxes = myKeys(state, currentUser)
  const keys = keysFromLockboxes[type] && keysFromLockboxes[type][name]
  if (!keys) throw new Error(`Keys not found for ${type.toLowerCase()} '${name}`)

  const generation = generationOrUndefined || keys.length - 1 // use latest generation by default
  return keys[generation]
}

// TODO: memoize this

/** Returns all keysets from the current user's lockboxes in a structure that looks like this:
 * ```ts
 * {
 *    TEAM: {
 *      TEAM: Keyset[], // <- all keys starting with generation 0
 *    ROLE: {
 *      admin: Keyset[]
 *      managers: Keyset[]
 *    },
 * }
 * ```
 */
const myKeys = (state: TeamState, currentUser: LocalUser): KeysetMap => {
  const usersOwnKeys = currentUser.keyHistory || [currentUser.keys] // if there's no history, just use the keys we have
  const allVisibleKeys = usersOwnKeys.flatMap(keys => getDerivedKeys(state, keys))
  return allVisibleKeys.reduce(organizeKeysIntoMap, {})
}

const getDerivedKeys = (state: TeamState, keyset: Keys): Keys[] => {
  const { lockboxes } = state
  const publicKey = keyset.encryption.publicKey
  const lockboxesICanUnlock = lockboxes.filter(({ recipient }) => recipient.publicKey === publicKey)
  const keysets = lockboxesICanUnlock.map(lockbox => open(lockbox, keyset))
  const derivedKeysets = keysets.flatMap(keyset => getDerivedKeys(state, keyset))
  return [...keysets, ...derivedKeysets]
}

const organizeKeysIntoMap = (result: KeysetMap, keys: Keys) => {
  const { type, name, generation } = keys
  const keysetsForScope = result[type] || {}
  const keysetHistory = keysetsForScope[name] || []
  keysetHistory[generation] = keys
  return {
    ...result,
    [type]: {
      ...keysetsForScope,
      [name]: keysetHistory,
    },
  } as KeysetMap
}

export interface KeysetMap {
  [type: string]: {
    [name: string]: Keys[]
  }
}
