import { asymmetric, signatures, symmetric } from '@localfirst/crypto'
import { describe, expect, it } from 'vitest'
import 'util/testing/expect/toLookLikeKeyset'
import { createUser, redactUser } from '../index.js'

describe('user', () => {
  it('creates a new user', () => {
    const bob = createUser('bob')
    expect(bob.userName).toBe('bob')
    expect(bob).toHaveProperty('keys')
  })

  describe('working keys', () => {
    const message = 'the crocodile lunges at dawn'

    it('provides a working keypair for signatures', () => {
      const bob = createUser('bob')
      const keypair = bob.keys.signature
      const { secretKey, publicKey } = keypair
      const signature = signatures.sign(message, secretKey)
      const signedMessage = { payload: message, signature, publicKey }
      expect(signatures.verify(signedMessage)).toBe(true)
    })

    it('provides a working keyset for asymmetric encryption', () => {
      const charlie = createUser('charlie')
      const charlieKeys = charlie.keys.encryption
      const bobKeys = asymmetric.keyPair()

      // Charlie encrypts a message for Bob
      const cipher = asymmetric.encryptBytes({
        secret: message,
        recipientPublicKey: bobKeys.publicKey,
        senderSecretKey: charlieKeys.secretKey,
      })

      // Bob decrypts the message
      const decrypted = asymmetric.decryptBytes({
        cipher,
        senderPublicKey: charlieKeys.publicKey,
        recipientSecretKey: bobKeys.secretKey,
      })
      expect(decrypted).toEqual(message)
    })

    it('provides a working keyset for symmetric encryption', () => {
      const bob = createUser('bob')
      const { secretKey } = bob.keys
      const cipher = symmetric.encryptBytes(message, secretKey)
      const decrypted = symmetric.decryptBytes(cipher, secretKey)
      expect(decrypted).toEqual(message)
    })
  })

  describe('redaction', () => {
    it('redacts user keys', () => {
      const bob = createUser('bob')
      const redacted = redactUser(bob)
      expect(redacted).toHaveProperty('keys')
      expect(redacted.keys).toHaveProperty('signature')
      expect(redacted.keys).toHaveProperty('encryption')
      expect(redacted.keys).not.toHaveProperty('secretKey')
    })
  })
})
