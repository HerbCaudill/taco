import { type Hash, hash, stretch } from '@localfirst/crypto'
import { HashPurpose } from '../util/constants.js'

export function deriveId(seed: string) {
  // ## Step 1b
  // The iKey is stretched using `scrypt` to discourage brute-force attacks (docs refer to this as
  // the `siKey`)
  const stretchedKey = stretch(seed)

  // ## Step 1c
  // The invitation id is derived from the stretched iKey, so Bob can generate it independently.
  // This will be visible in the signature chain and serves to uniquely identify the invitation.
  // (Keybase docs: `inviteID`)
  return hash(HashPurpose.INVITATION, stretchedKey).slice(0, 15) as Hash
}
