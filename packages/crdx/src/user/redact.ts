import { type UserWithSecrets } from './types.js'
import { redactKeys } from '../keyset/index.js'
import { type User } from '../index.js'

export const redactUser = (user: User | UserWithSecrets): User => {
  const { userId, userName } = user
  return {
    userId,
    userName,
    keys: redactKeys(user.keys),
  }
}
