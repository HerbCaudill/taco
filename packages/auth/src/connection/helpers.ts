import type { ConnectionMessage } from './message.js'
import { syncMessageSummary } from '../util/testing/messageSummary.js'
import type { Context, ServerContext } from './types.js'

// HELPERS
// FOR DEBUGGING
export const messageSummary = (message: ConnectionMessage) =>
  message.type === 'SYNC'
    ? `SYNC ${syncMessageSummary(message.payload)}`
    : // @ts-expect-error utility function don't worry about it
      `${message.type} ${message.payload?.head?.slice(0, 5) || message.payload?.message || ''}`
const isString = (state: any): state is string => typeof state === 'string'
// ignore coverage
export const stateSummary = (state: any): string =>
  isString(state)
    ? state
    : Object.keys(state)
        .map(key => `${key}:${stateSummary(state[key])}`)
        .filter(s => s.length)
        .join(',')
/**
 * A server is conceptually kind of a user and kind of a device. This little hack lets us avoid
 * creating special logic for servers all over the place.
 */
export const extendServerContext = (context: ServerContext) => {
  const { keys, host } = context.server
  return {
    ...context,
    user: { userId: host, userName: host, keys },
    device: { userId: host, deviceId: host, deviceName: host, keys },
  }
}
export const getUserName = (context: Context) => {
  if ('server' in context) return context.server.host
  if ('userName' in context) return context.userName
  if ('user' in context) return context.user.userName
  return ''
}
