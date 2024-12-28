import { asymmetric, keyToBytes, signatures } from '@localfirst/crypto'
import { describe, expect, it } from 'vitest'
import { EPHEMERAL_SCOPE } from '../../constants.js'
import { createKeyset } from '../createKeyset.js'
import { KeyType } from '../types.js'

const { USER } = KeyType

describe('create', () => {
  it('returns keys with the expected lengths', () => {
    const keys = createKeyset(EPHEMERAL_SCOPE)

    const { signature, encryption } = keys

    // signature keys look right
    expect(keyToBytes(signature.publicKey)).toHaveLength(32)
    expect(keyToBytes(signature.secretKey)).toHaveLength(64)

    // encryption keys look right
    expect(keyToBytes(encryption.publicKey)).toHaveLength(32)
    expect(keyToBytes(encryption.secretKey)).toHaveLength(32)
  })

  it('returns keys with the expected metadata', () => {
    const keys = createKeyset({ type: USER, name: 'alice' })

    expect(keys.type).toEqual(USER)
    expect(keys.name).toEqual('alice')
  })

  it('produces working signature keys', () => {
    const keys = createKeyset(EPHEMERAL_SCOPE)
    const { secretKey, publicKey } = keys.signature

    // Alice signs a message
    const payload = 'si vis frumenti, necesse est plantandi frumentum'
    const signature = signatures.sign(payload, secretKey)

    // Bob checks it
    const isLegit = signatures.verify({ payload, signature, publicKey })
    expect(isLegit).toBe(true)
  })

  it('produces working keys for asymmetric encryption', () => {
    const alice = createKeyset({ type: USER, name: 'alice' }).encryption
    const bob = createKeyset({ type: USER, name: 'bob' }).encryption

    const message = 'The dolphin leaps at twilight'

    // Alice encrypts a message for Bob
    const encrypted = asymmetric.encryptBytes({
      secret: message,
      recipientPublicKey: bob.publicKey,
      senderSecretKey: alice.secretKey,
    })

    // Bob decrypts it
    const decrypted = asymmetric.decryptBytes({
      cipher: encrypted,
      senderPublicKey: alice.publicKey,
      recipientSecretKey: bob.secretKey,
    })
    expect(decrypted).toEqual(message)
  })
})
