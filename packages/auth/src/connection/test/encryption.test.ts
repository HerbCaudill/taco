import { describe, expect, it } from 'vitest'
import { connect, setup } from 'util/testing/index.js'
import { eventPromise } from '@localfirst/shared'

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
})
