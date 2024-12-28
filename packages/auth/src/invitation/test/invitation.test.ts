import { describe, expect, test } from 'vitest'
import { create, generateProof, randomSeed, validate } from '../index.js'

describe('invitations', () => {
  test('create invitation', () => {
    const seed = randomSeed()
    const invitation = create({ seed })
    // Looks like an invitation
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('publicKey')
  })

  test('validate member invitation', () => {
    // 👩🏾 Alice generates a secret key and sends it to 👨🏻‍🦲 Bob via a trusted side channel.
    const seed = 'passw0rd'

    // 👩🏾 Alice generates an invitation with this key. Normally the invitation would be stored on the
    // team's signature chain; here we're just keeping it around in a variable.
    const invitation = create({ seed })

    // 👨🏻‍🦲 Bob accepts invitation and obtains a credential proving that he was invited.
    const proofOfInvitation = generateProof(seed)

    // 👨🏻‍🦲 Bob shows up to join the team & sees 👳🏽‍♂️ Charlie. Bob shows Charlie his proof of invitation, and
    // 👳🏽‍♂️ Charlie checks it against the invitation that Alice posted on the signature chain.
    const validationResult = validate(proofOfInvitation, invitation)

    // ✅
    expect(validationResult.isValid).toBe(true)
  })

  test('you have to have the secret key to accept an invitation', () => {
    // 👩🏾 Alice uses a secret key to create an invitation; she sends it to Bob via a trusted side channel
    const seed = 'passw0rd'

    // And uses it to create an invitation for him
    const invitation = create({ seed })

    // 🦹‍♀️ Eve tries to accept the invitation in Bob's place, but she doesn't have the correct invitation key
    const proofOfInvitation = generateProof('horsebatterycorrectstaple')

    // ❌ Nice try, Eve!!!
    const validationResult = validate(proofOfInvitation, invitation)
    expect(validationResult.isValid).toBe(false)
  })
})
