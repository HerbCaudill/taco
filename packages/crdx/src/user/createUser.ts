import { randomKey } from '@localfirst/crypto'
import { createId } from '@paralleldrive/cuid2'
import { createKeyset, KeyType } from '../keyset/index.js'
import { type UserWithSecrets } from './types.js'

/**
 * Creates a new local user, with randomly-generated keys.
 */
export const createUser = (
  userName: string,
  userId: string = createId(),
  seed: string = randomKey()
): UserWithSecrets => {
  return {
    userName,
    userId,
    keys: createKeyset({ type: KeyType.USER, name: userId }, seed),
  }
}
