import { TestChannel, all, connect, joinTestChannel, setup } from '../../util/testing/index.js'
import { pause } from '@localfirst/shared'
import { describe, it } from 'vitest'

describe('connection', () => {
  it('should connect', async () => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel and connect
    await connect(alice, bob)
  })

  it('should connect even with a delayed start', async () => {
    const { alice, bob } = setup('alice', 'bob')

    const join = joinTestChannel(new TestChannel())

    const bobConnection = join(bob.connectionContext)
    const aliceConnection = join(alice.connectionContext)

    aliceConnection.start()
    await pause(100)
    bobConnection.start()

    await all([aliceConnection, bobConnection], 'connected')
  })

  it('should connect even when messages are dropped', async () => {
    const { alice, bob } = setup('alice', 'bob')

    const join = joinTestChannel(new BadChannel()) // <- BadChannel drops messages

    const aliceConnection = join(alice.connectionContext).start()
    const bobConnection = join(bob.connectionContext).start()

    await all([aliceConnection, bobConnection], 'connected')
  })
})

/**
 * This channel is like TestChannel but it drops one message
 */
export class BadChannel extends TestChannel {
  private messageCount = 0
  write(senderId: string, message: Uint8Array) {
    this.messageCount++
    if (this.messageCount === 3) return // <- drop the third message we see
    super.write(senderId, message)
  }
}
