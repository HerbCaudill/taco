import { hash, asymmetric, signatures, stretch, randomKey } from '@localfirst/crypto'
import { type KeyScope, type KeysetWithSecrets } from './types.js'
import { HashPurpose } from '../constants.js'
import { type Optional } from '../util/index.js'

const { SIGNATURE, ENCRYPTION, SYMMETRIC } = HashPurpose

/** Generates a full set of per-user keys from a single 32-byte secret, roughly following the
 *  procedure outlined in the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).
 * */
export const createKeyset = (
  /** The scope associated with the new keys - e.g. `{ type: TEAM }` or `{type: ROLE, name: ADMIN}`.  */
  scope: Optional<KeyScope, 'name'>,

  /** A strong secret key used to derive the other keys. This key should be randomly generated to
   *  begin with and never stored. If not provided, a 32-byte random key will be generated and used. */
  seed: string = randomKey()
): KeysetWithSecrets => {
  const { type, name = type } = scope
  const stretchedSeed = stretch(`${name}:${type}:${seed}`)
  return {
    type,
    name,
    generation: 0,
    signature: signatures.keyPair(hash(SIGNATURE, stretchedSeed).slice(0, 32)),
    encryption: asymmetric.keyPair(hash(ENCRYPTION, stretchedSeed).slice(0, 32)),
    secretKey: hash(SYMMETRIC, stretchedSeed),
  }
}
