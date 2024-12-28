import { type Keyset, type KeysetWithSecrets } from '../keyset/index.js'

export type User = {
  /** Unique ID populated on creation. */
  userId: string

  /** Username (or email). Must be unique but is not used for lookups. Only provided to connect
   * human identities with other systems. */
  userName: string

  /** The user's public keys. */
  keys: Keyset
}

/** The local user and their full set of keys, including secrets.   */
export type UserWithSecrets = {
  userId: string
  userName: string

  /** The user's secret keys. */
  keys: KeysetWithSecrets
}
