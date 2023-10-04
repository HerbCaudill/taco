import { Connection } from '@/connection/Connection.js'
import { InitialContext, SendFunction } from '@/connection/types.js'
import { getDeviceId } from '@/device/index.js'
import { pause } from './pause.js'
import { TestChannel } from './TestChannel.js'

/** Returns a function that can be used to join a specific test channel */
export const joinTestChannel = (channel: TestChannel) => (context: InitialContext) => {
  const id = getDeviceId(context.device)

  // hook up send
  const sendMessage: SendFunction = msg => channel.write(id, msg)

  // Instantiate the connection service
  const connection = new Connection({ sendMessage, context })

  // hook up receive
  channel.addListener('data', async (senderId, msg) => {
    if (senderId === id) return // ignore messages that I sent

    // simulate a random delay, then deliver the message
    const delay = 1 //Math.floor(Math.random() * 100)
    await pause(delay)
    connection.deliver(msg)
  })

  channel.addPeer()

  return connection
}
