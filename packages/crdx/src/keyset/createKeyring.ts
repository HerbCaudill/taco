import { arrayToMap } from '../util/index.js'
import { isKeyring, isKeyset, type Keyring, type KeysetWithSecrets } from './types.js'

export const createKeyring = (keys: Keyring | KeysetWithSecrets | KeysetWithSecrets[]): Keyring => {
  // if it's already a keyring, just return it
  if (isKeyring(keys)) return keys

  // coerce a single keyset into an array of keysets
  if (isKeyset(keys)) keys = [keys]

  // organize into a map of keysets by public key
  return keys.reduce(
    arrayToMap((k: KeysetWithSecrets) => k.encryption.publicKey),
    {}
  )
}
