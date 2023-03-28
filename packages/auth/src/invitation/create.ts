﻿import { deriveId } from '@/invitation/deriveId'
import { normalize } from '@/invitation/normalize'
import { Invitation } from '@/invitation/types'
import { UnixTimestamp } from '@localfirst/crdx'
import { generateStarterKeys } from './generateStarterKeys'

export const IKEY_LENGTH = 16

/**
 * Returns an an invitation to publicly post on the team's signature chain. Inspired by Keybase's
 * Seitan Token v2 exchange protocol.
 */
export const create = ({
  seed,
  maxUses = 1, // by default an invitation can only be used once
  expiration = 0 as UnixTimestamp, // by default an invitation never expires
  userId,
}: CreateOptions): Invitation => {
  seed = normalize(seed)

  // the ID of the invitation is derived from the seed
  const id = deriveId(seed)

  // the ephemeral public signature key will be used to verify Bob's proof of invitation
  const starterKeys = generateStarterKeys(seed)
  const { publicKey } = starterKeys.signature

  return { id, publicKey, expiration, maxUses, userId }
}

type CreateOptions = {
  /** A randomly generated secret to be passed to Bob via a side channel */
  seed: string

  /** Time when the invitation expires. If 0, the invitation does not expire. */
  expiration?: UnixTimestamp

  /** Number of times the invitation can be used. If 0, the invitation can be used any number of times. By default, an invitation can only be used once. */
  maxUses?: number

  /** (Device invitations only) User name the device will be associated with. */
  userId?: string
}
