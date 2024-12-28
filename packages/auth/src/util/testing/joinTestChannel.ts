import { Connection } from '../../connection/Connection.js'
import { isServerContext, type Context } from '../../connection/types.js'
import { type TestChannel } from './TestChannel.js'
import { pause } from '@localfirst/shared'

/** Returns a function that can be used to join a specific test channel */
export const joinTestChannel = (channel: TestChannel) => (context: Context) => {
  const id = isServerContext(context) ? context.server.host : context.device.deviceId
  // Hook up send
  const sendMessage = (message: Uint8Array) => {
    channel.write(id, message)
  }

  // Instantiate the connection service
  const connection = new Connection({ sendMessage, context })

  // Hook up receive
  channel.addListener('data', async (senderId, message) => {
    if (senderId === id) return // ignore messages that I sent
    await pause(1)
    connection.deliver(message)
  })

  channel.addPeer()

  return connection
}
