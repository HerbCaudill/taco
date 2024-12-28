import { type KeyMetadata, type KeyScope, type KeysetWithSecrets } from '@localfirst/crdx'
import { keyMap } from './keyMap.js'
import { type TeamState } from '../types.js'
import { assert } from '@localfirst/shared'
import { lockboxSummary } from '../../util/lockboxSummary.js'

/** Returns the keys for the given scope, if they are in a lockbox that the current device has access to */
export const keys = (
  state: TeamState,
  deviceKeys: KeysetWithSecrets,
  scope: KeyScope | KeyMetadata
) => {
  const { type, name } = scope

  const keysFromLockboxes = keyMap(state, deviceKeys)
  const keys = keysFromLockboxes[type] ? keysFromLockboxes[type][name] : undefined

  assert(
    keys,
    `Couldn't find keys: ${JSON.stringify(scope)}
     Device: ${deviceKeys.name}
     Available lockboxes: \n- ${state.lockboxes.map(lockboxSummary).join('\n- ')}
     Keymap: ${JSON.stringify(keysFromLockboxes, null, 2)}`
  )

  const generation =
    'generation' in scope && scope.generation !== undefined
      ? // Return specific generation if requested
        scope.generation
      : // Use latest generation by default
        keys.length - 1

  return keys[generation]
}
