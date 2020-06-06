﻿import { Device } from '/context'
import { Keys } from '/keys'

/** The local user and their full set of keys, including secrets.   */
export interface LocalUser {
  /** Username (or ID or email) */
  name: string

  /** The user's most recent keys, including their secrets. */
  keys: Keys

  /** All the user's keysets over their history of key rotation.
   * The index of the keyset in the array corresponds to the
   * key generation: previousKeys[0] is generation 0, etc.
   */
  keyHistory?: Keys[]

  devices?: Device[]
}
