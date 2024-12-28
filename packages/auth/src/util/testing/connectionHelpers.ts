// ignore file coverage
import { eventPromise } from '@localfirst/shared'
import { type Connection, type ConnectionEvents } from '../../connection/index.js'
import { type InviteeDeviceContext, type InviteeMemberContext } from '../../connection/types.js'
import { expect } from 'vitest'
import { TestChannel } from './TestChannel.js'
import { joinTestChannel } from './joinTestChannel.js'
import { type UserStuff } from './setup.js'

// HELPERS

export const tryToConnect = async (a: UserStuff, b: UserStuff) => {
  const join = joinTestChannel(new TestChannel())

  a.connection[b.deviceId] = join(a.connectionContext).start()
  b.connection[a.deviceId] = join(b.connectionContext).start()
}

/** Connects the two members and waits for them to be connected */
export const connect = async (a: UserStuff, b: UserStuff) => {
  void tryToConnect(a, b)
  return Promise.race([
    connection(a, b).then(() => true), //
    anyDisconnected(a, b).then(() => false),
  ])
}

/** Connects a member with an invitee. */
export const connectWithInvitation = async (
  member: UserStuff,
  invitee: UserStuff,
  seed: string
) => {
  invitee.connectionContext = {
    user: invitee.user,
    device: invitee.device,
    invitationSeed: seed,
  } as InviteeMemberContext

  return connect(member, invitee).then(() => {
    // The connection now has the team object, so let's update our user stuff
    invitee.team = invitee.connection[member.deviceId].team!
  })
}

export const connectPhoneWithInvitation = async (user: UserStuff, seed: string) => {
  const phoneContext: InviteeDeviceContext = {
    userName: user.user.userName,
    device: user.phone!,
    invitationSeed: seed,
  }

  const join = joinTestChannel(new TestChannel())

  const laptopConnection = join(user.connectionContext).start()
  const phoneConnection = join(phoneContext).start()

  await all([laptopConnection, phoneConnection], 'connected')
  user.team = laptopConnection.team!
  user.connection = { [user.phoneStuff!.deviceId]: phoneConnection }
  user.phoneStuff!.team = phoneConnection.team!
  user.phoneStuff!.connection = { [user.deviceId]: laptopConnection }
}

/** Passes if each of the given members is on the team, and knows every other member on the team */
export const expectEveryoneToKnowEveryone = (...members: UserStuff[]) => {
  for (const a of members) {
    for (const b of members) {
      if (!a.team.has(b.userId)) {
        throw new Error(`${a.userName} does not have ${b.userName} on their team`)
      }
    }
  }
}

/** Disconnects the two members and waits for them to be disconnected */
export const disconnect = async (a: UserStuff, b: UserStuff) =>
  Promise.all([
    disconnection(a, b),
    a.connection[b.deviceId].stop(),
    b.connection[a.deviceId].stop(),
  ])

// PROMISIFIED EVENTS
export const connection = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]

  // ✅ They're both connected
  await all(connections, 'connected')

  const sharedKey = connections[0]._sessionKey
  for (const connection of connections) {
    // ✅ They've converged on a shared secret key
    expect(connection._sessionKey).toEqual(sharedKey)
  }
}

export const updated = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]
  return all(connections, 'updated')
}

export const anyUpdated = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]
  return any(connections, 'updated')
}

export const anyDisconnected = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]
  return any(connections, 'disconnected')
}

export const disconnection = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]
  const activeConnections = connections.filter(c => c.state !== 'disconnected')

  // ✅ They're both disconnected
  await all(activeConnections, 'disconnected')
  // for (const connection of activeConnections) expect(connection.state).toEqual('disconnected')
}

export const all = async (connections: Connection[], event: keyof ConnectionEvents) =>
  Promise.all(
    connections.map(async connection => {
      if (event === 'disconnected' && connection.state === 'disconnected') return connection
      if (event === 'connected' && connection.state === 'connected') return connection
      return eventPromise(connection, event)
    })
  )

export const any = async (connections: Connection[], event: keyof ConnectionEvents) =>
  Promise.any(
    connections.map(async connection => {
      if (event === 'disconnected' && connection.state === 'disconnected') return connection
      if (event === 'connected' && connection.state === 'connected') return connection
      return eventPromise(connection, event)
    })
  )
