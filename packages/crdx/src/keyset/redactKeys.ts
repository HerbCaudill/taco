import { hasSecrets, type Keyset, type KeysetWithSecrets } from '../keyset/types.js'

/**
 * There are two kinds of keysets:
 *
 * - **`KeysetWithSecrets`** includes the secret keys (for example, our user or device keys, or keys
 *   for roles we belong to)
 * - **`Keyset`** only includes the public keys (for example, other users' keys, or keys for
 *   roles we don't belong to)
 *
 * The `redact` function takes a `KeysetWithSecrets`, and returns a `Keyset`.
 *
 * ```js
 * const adminPublicKeys = keyset.redactKeys(adminKeys)
 *
 * {
 *   // the metadata is unchanged
 *   type: 'ROLE',
 *   name: 'admin',
 *   generation: 0,
 *   // instead of keypairs, these are just the public keys
 *   signature: '...', // = adminKeys.signature.publicKey
 *   encryption: '...', // = adminKeys.encryption.publicKey
 * }
 * ```
 *
 * You can also pass in a `Keyset`, in which case it will be returned as-is.
 */
export const redactKeys = (keys: KeysetWithSecrets | Keyset): Keyset =>
  hasSecrets(keys)
    ? {
        type: keys.type,
        name: keys.name,
        generation: keys.generation,
        encryption: keys.encryption.publicKey,
        signature: keys.signature.publicKey,
      }
    : keys
