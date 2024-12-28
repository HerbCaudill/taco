import { describe, expect, it } from 'vitest'
import { connect, setup } from '../../util/testing/index.js'
import { eventPromise } from '@localfirst/shared'
import { randomKeyBytes } from '@localfirst/crypto'

describe('connection', () => {
  describe('encryption', () => {
    it('allows Alice and Bob to send each other encrypted messages', async () => {
      const { alice, bob } = setup('alice', 'bob')

      // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
      await connect(alice, bob)

      // 👨🏻‍🦲 Bob sets up his message handler
      const messagePromise = eventPromise(bob.connection[alice.deviceId], 'message')

      // 👩🏾 Alice sends a message
      alice.connection[bob.deviceId].send('hello')

      // 👨🏻‍🦲 Bob receives it
      const d = await messagePromise
      expect(d).toEqual('hello')
    })
  })

  it('fails if one person has the wrong session key', async () => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
    await connect(alice, bob)

    // For some reason Bob's session key is changed
    bob.connection[alice.deviceId]._context.sessionKey = randomKeyBytes(32)

    alice.connection[bob.deviceId].send('hello')

    const error = await eventPromise(bob.connection[alice.deviceId], 'localError')
    expect(error.type).toBe('ENCRYPTION_FAILURE')
  })
})
