// ignore file coverage
import { TEST_GRAPH_KEYS as keys } from './setup.js'
import { expect } from 'vitest'
import { setup } from './setup.js'
import { createGraph, type Graph, headsAreEqual } from '../../graph/index.js'
import { type KeysetWithSecrets } from '../../keyset/index.js'
import { generateMessage } from '../../sync/generateMessage.js'
import { initSyncState } from '../../sync/initSyncState.js'
import { receiveMessage } from '../../sync/receiveMessage.js'
import { type SyncMessage, type SyncState } from '../../sync/types.js'
import { type UserWithSecrets } from '../../user/index.js'

/** Simulates a peer-to-peer network. */
export class Network {
  peers: Record<string, Peer>
  queue: NetworkMessage[]
  keys: KeysetWithSecrets
  constructor(keys: KeysetWithSecrets) {
    this.peers = {}
    this.queue = []
    this.keys = keys
  }

  registerPeer(peer: Peer) {
    this.peers[peer.userName] = peer
  }

  /** Establishes a bidirectionial connection between two peers */
  connect(a: Peer, b: Peer) {
    this.registerPeer(a)
    this.registerPeer(b)
    a.connect(b.userName)
    b.connect(a.userName)
  }

  /** Enqueues one message to be sent from fromPeer to toPeer */
  sendMessage(from: string, to: string, body: SyncMessage) {
    this.queue.push({ from, to, body })
  }

  /** Runs the protocol until all peers run out of things to say */
  deliverAll() {
    let messageCount = 0
    const peerCount = Object.keys(this.peers).length
    const maxMessages = 3 ** peerCount // should be plenty - any more & something has gone haywire

    const delivered = [] as NetworkMessage[]

    while (this.queue.length > 0) {
      // catch failure to converge
      if (messageCount++ > maxMessages) throw new Error('loop detected')

      // send the oldest message in the queue
      const message = this.queue.shift()!

      const { to, from, body } = message
      this.peers[to].receiveMessage(from, body)

      delivered.push(message)
    }

    return delivered
  }
}

/** One peer, which may be connected to any number of other peers */
export class Peer {
  syncStates: Record<string, SyncState>

  constructor(
    public userName: string,
    public graph: Graph<any, any>,
    public network: Network
  ) {
    this.network.registerPeer(this)
    this.syncStates = {}
  }

  /**  Called by Network.connect when a connection is established with a remote peer */
  connect(userName: string) {
    this.syncStates[userName] = initSyncState()
  }

  /**  Generates and enqueues messages to the named peer (or if none given, to all peers we're connected to) (unless there is nothing to send) */
  sync(userName?: string) {
    if (userName) {
      // sync only with this peer
      const [syncState, message] = generateMessage(this.graph, this.syncStates[userName])
      this.syncStates[userName] = syncState
      if (message) this.network.sendMessage(this.userName, userName, message)
    } else {
      // sync with everyone
      for (const userName of Object.keys(this.syncStates)) this.sync(userName)
    }
  }

  /** Called by Network when we receive a message from another peer */
  receiveMessage(sender: string, message: SyncMessage) {
    if (message.error) {
      throw new Error(`${message.error.message}\n${JSON.stringify(message.error.details, null, 2)}`)
    }

    const prevHead = this.graph.head

    const [graph, syncState] = receiveMessage(this.graph, this.syncStates[sender], message, keys)
    this.graph = graph
    this.syncStates[sender] = syncState

    // has our graph changed at all as a result of this message?
    if (headsAreEqual(prevHead, graph.head)) {
      // no change, just reply to the sender
      this.sync(sender)
    } else {
      // our graph has changed, sync with everyone
      this.sync()
    }
  }
}

export const setupWithNetwork =
  (keys: KeysetWithSecrets) =>
  (...userNames: string[]) => {
    const users = setup(...userNames)
    const founderUserName = userNames[0]
    const founderUser = users[founderUserName]

    const graph = createGraph({ user: founderUser, keys })

    const network = new Network(keys)

    const userRecords = {} as Record<string, TestUserStuff>
    for (const userName in users) {
      const user = users[userName]
      const peer = new Peer(userName, graph, network)
      userRecords[userName] = { user, peer }
    }

    const founder = userRecords[founderUserName]
    return { userRecords, network, founder }
  }

export const expectToBeSynced = (a: TestUserStuff, b: TestUserStuff) => {
  expect(a.peer.graph.head).toEqual(b.peer.graph.head)
}

export const expectNotToBeSynced = (a: TestUserStuff, b: TestUserStuff) => {
  expect(a.peer.graph.head).not.toEqual(b.peer.graph.head)
}

export type NetworkMessage = {
  to: string
  from: string
  body: SyncMessage
}

export type TestUserStuff = {
  user: UserWithSecrets
  peer: Peer
}
