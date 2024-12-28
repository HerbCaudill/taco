import { memoize } from '@localfirst/shared'
import { type KeysetWithSecrets } from '@localfirst/crdx'
import { asymmetric } from '@localfirst/crypto'
import { type Lockbox } from './types.js'

export const open = memoize(
  (lockbox: Lockbox, decryptionKeys: KeysetWithSecrets): KeysetWithSecrets => {
    const { encryptionKey, encryptedPayload } = lockbox

    const decrypted = asymmetric.decryptBytes({
      cipher: encryptedPayload,
      senderPublicKey: encryptionKey.publicKey,
      recipientSecretKey: decryptionKeys.encryption.secretKey,
    })
    const keys = decrypted as unknown as KeysetWithSecrets

    return keys
  }
)
