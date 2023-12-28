import type {
  DocumentId,
  Message,
  NetworkAdapter,
  PeerId,
  StorageAdapter,
} from '@automerge/automerge-repo'
import * as Auth from '@localfirst/auth'
import { debug, eventPromise } from '@localfirst/auth-shared'
import { type AbstractConnection } from 'AbstractConnection.js'
import { AnonymousConnection } from 'AnonymousConnection.js'
import { EventEmitter } from 'eventemitter3'
import { pack, unpack } from 'msgpackr'
import { AuthenticatedNetworkAdapter as AuthNetworkAdapter } from './AuthenticatedNetworkAdapter.js'
import { CompositeMap } from './CompositeMap.js'
import { forwardEvents } from './forwardEvents.js'
import type {
  AuthProviderEvents,
  Invitation,
  LocalFirstAuthMessage,
  LocalFirstAuthMessagePayload,
  SerializedShare,
  SerializedState,
  Share,
  ShareId,
} from './types.js'
import { isAuthMessage, isDeviceInvitation, isPrivateShare } from './types.js'

const { encryptBytes, decryptBytes } = Auth.symmetric

/**
 * This class is used to wrap automerge-repo network adapters so that they authenticate peers and
 * encrypt network traffic, using [localfirst/auth](https://github.com/local-first-web/auth).
 *
 * To use:
 *
 * 1. Create a AuthProvider, using the same storage adapter that the repo will use:
 *
 *    ```ts
 *    const storage = new SomeStorageAdapter()
 *    const auth = new AuthProvider({ user, device, storage })
 *    ```
 * 2. Wrap your network adapter(s) with its `wrap` method.
 *    ```ts
 *   const adapter = new SomeNetworkAdapter()
 *   const authenticatedAdapter = auth.wrap(adapter)
 *   ```
 * 3. Pass the wrapped adapters to the repo.
 *   ```ts
 *  const repo = new Repo({
 *    storage,
 *    network: [authenticatedAdapter],
 *  })
 */
export class AuthProvider extends EventEmitter<AuthProviderEvents> {
  readonly #device: Auth.DeviceWithSecrets
  #user?: Auth.UserWithSecrets
  readonly storage: StorageAdapter

  readonly #adapters: Array<AuthNetworkAdapter<NetworkAdapter>> = []
  readonly #invitations = new Map<ShareId, Invitation>()
  readonly #shares = new Map<ShareId, Share>()
  readonly #connections = new CompositeMap<[ShareId, PeerId], AbstractConnection>()
  readonly #storedMessages = new CompositeMap<[ShareId, PeerId], Uint8Array[]>()
  readonly #peers = new Map<NetworkAdapter, PeerId[]>()
  readonly #server: string[]

  #log = debug.extend('auth-provider')

  constructor({ device, user, storage, server = [] }: Config) {
    super()

    // We always are given the local device's info & keys
    this.#device = device

    // We might already have our user info, unless we're a new device using an invitation
    if (user?.userName) {
      this.#user = user
      this.#log = this.#log.extend(user.userName)
    }

    this.#log('instantiating %o', {
      userName: user?.userName,
      deviceId: device.deviceId,
    })

    this.#server = asArray(server)

    // Load any existing state from storage
    this.storage = storage
    this.#loadState()
      .then(() => this.emit('ready'))
      .catch(error => {
        throw error as Error
      })
  }

  /**
   * Intercept the network adapter's events. For each new peer, we create a localfirst/auth
   * connection and use it to mutually authenticate before forwarding the peer-candidate event.
   */
  public wrap = (baseAdapter: NetworkAdapter) => {
    // All repo messages for this adapter are handled by the Auth.Connection, which encrypts them
    // and guarantees authenticity.
    const send = (message: Message) => {
      this.#log('sending message from connection %o', message)
      const shareId = this.#getShareIdForMessage(message)
      const connection = this.#getConnection(shareId, message.targetId)

      // wait for connection to be ready before sending

      const awaitConnected = async (connection: AbstractConnection) => {
        this.#log('awaitConnected (%s)', connection.state)
        if (connection.state === 'connected') return
        return eventPromise(connection, 'connected')
      }

      awaitConnected(connection)
        .then(() => {
          connection.send(message)
        })
        .catch(error => {
          this.#log('error sending message from connection %o', error)
        })
    }
    const authAdapter = new AuthNetworkAdapter(baseAdapter, send)

    // try to authenticate new peers; if we succeed, we forward the peer-candidate to the network subsystem
    baseAdapter
      .on('peer-candidate', ({ peerId }) => {
        // TODO: we need to store the storageId and isEphemeral in order to provide that info in the peer-candidate event

        this.#log('peer-candidate %o', peerId)
        this.#addPeer(baseAdapter, peerId)

        // We optimistically spin up a connection for each share we have and every unused invitation
        // we have. Messages regarding shares we're not a member of will be ignored.
        for (const shareId of this.#allShareIds())
          void this.#createConnection({ shareId, peerId, authAdapter })
      })

      // Intercept any incoming messages and pass them to the Auth.Connection.
      .on('message', message => {
        this.#log('message from adapter %o', message)

        if (!isAuthMessage(message)) throw new Error('Not an auth message')
        const { senderId, payload } = message
        const { shareId, serializedConnectionMessage } = payload as LocalFirstAuthMessagePayload

        // If we don't have a connection for this message, store it until we do
        if (!this.#connections.has([shareId, senderId])) {
          this.#storeMessage(shareId, senderId, serializedConnectionMessage)
          return
        }

        // Pass message to the auth connection
        const connection = this.#getConnection(shareId, senderId)

        connection.deliver(serializedConnectionMessage)
      })

      .on('peer-disconnected', ({ peerId }) => {
        this.#log('peer-disconnected %o', peerId)
        // Disconnect all connections with this peer
        for (const shareId of this.#allShareIds()) {
          if (this.#connections.has([shareId, peerId])) {
            this.#disconnect(shareId, peerId)
          }
        }
      })

    // forward all other events from the base adapter to the repo
    forwardEvents(baseAdapter, authAdapter, ['ready', 'close', 'peer-disconnected', 'error'])

    this.#adapters.push(authAdapter)
    return authAdapter
  }

  /**
   * Returns the share with the given id. Throws an error if the shareId doesn't exist.
   */
  public getShare(shareId: ShareId) {
    const share = this.#shares.get(shareId)
    if (!share) throw new Error(`Share not found`)
    return share
  }

  /**
   * Creates a team and registers it with all of our sync servers.
   */
  public async createTeam(teamName: string) {
    const team = await Auth.createTeam(teamName, {
      device: this.#device,
      user: this.#user,
    })

    await this.registerTeam(team)
    return team
  }

  /**
   * Registers an existing team with all of our sync servers.
   */
  public async registerTeam(team: Auth.Team) {
    await this.addTeam(team)

    await Promise.all(
      this.#server.map(async url => {
        // url could be "localhost:3000" or "syncserver.example.com"
        const host = url.split(':')[0] // omit port

        // get the server's public keys
        const response = await fetch(`http://${url}/keys`)
        const keys = await response.json()

        // add the server's public keys to the team
        team.addServer({ host, keys })

        // register the team with the server
        await fetch(`http://${url}/teams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serializedGraph: team.save(),
            teamKeyring: team.teamKeyring(),
          }),
        })
      })
    )
  }

  /**
   * Creates a share for a team we're already a member of.
   */
  public async addTeam(team: Auth.Team) {
    this.#log('adding team %o', team.teamName)
    const shareId = team.id
    const share: Share = { shareId, team, documentIds: new Set() }
    this.#shares.set(shareId, share)
    await this.#saveState()
    team.on('updated', async () => {
      await this.#saveState()
    })
    await this.#createConnectionsForShare(shareId)
  }

  /**
   * Returns true if there is a share containing a team with the given id.
   */
  public hasTeam(shareId: ShareId) {
    return this.#shares.has(shareId) && isPrivateShare(this.getShare(shareId))
  }

  /**
   * Returns the team with the given id. Throws an error if the shareId doesn't exist or if it
   * doesn't have a team (is public).
   */
  public getTeam(shareId: ShareId) {
    const share = this.getShare(shareId)
    if (!isPrivateShare(share)) throw new Error(`Share ${shareId} is public`)
    return share.team
  }

  /**
   * Creates a share for a team we've been invited to, either as a new member or as a new device for
   * an existing member.
   */
  public async addInvitation(invitation: Invitation) {
    const { shareId } = invitation
    this.#invitations.set(shareId, invitation)
    await this.#createConnectionsForShare(shareId)
  }

  public async addPublicShare(shareId: ShareId) {
    this.#log('add public share %s', shareId)
    const share = this.#shares.get(shareId)

    if (!share) {
      this.#shares.set(shareId, { shareId })
      await this.#saveState()
    }

    await this.#createConnectionsForShare(shareId)
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  public addDocuments(shareId: ShareId, documentIds: DocumentId[]) {
    throw new Error('not implemented')
    // const share = this.getShare(shareId)
    // documentIds.forEach(id => share.documentIds.add(id))
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  public removeDocuments(shareId: ShareId, documentIds: DocumentId[]) {
    throw new Error('not implemented')
    // const share = this.getShare(shareId)
    // documentIds.forEach(id => share.documentIds.delete(id))
  }

  // PRIVATE

  /**
   * We might get messages from a peer before we've set up an Auth.Connection with them.
   * We store these messages until there's a connection to hand them off to.
   */
  #storeMessage(shareId: ShareId, peerId: PeerId, message: Uint8Array) {
    const messages = this.#getStoredMessages(shareId, peerId)
    this.#storedMessages.set([shareId, peerId], [...messages, message])
  }

  #getStoredMessages(shareId: ShareId, peerId: PeerId) {
    return this.#storedMessages.get([shareId, peerId]) ?? []
  }

  /**
   * An Auth.Connection executes the localfirst/auth protocol to authenticate a peer, negotiate a
   * shared secret key for the session, and sync up the team graph. This communication happens
   * over a network adapter that we've wrapped.
   */
  async #createConnection<T extends NetworkAdapter>({
    shareId,
    peerId,
    authAdapter,
  }: {
    shareId: ShareId
    peerId: PeerId
    authAdapter: AuthNetworkAdapter<T>
  }) {
    this.#log('creating connection %o', { shareId, peerId })
    const { baseAdapter } = authAdapter

    // wait until the adapter is ready
    await new Promise<void>(resolve => {
      if (authAdapter.isReady) resolve()
      else baseAdapter.once('ready', () => resolve())
    })

    const context = this.#getContextForShare(shareId)

    // The Auth connection uses the base adapter as its network transport
    const sendMessage = (serializedConnectionMessage: Uint8Array) => {
      const authMessage: LocalFirstAuthMessage = {
        type: 'auth',
        senderId: baseAdapter.peerId!,
        targetId: peerId,
        payload: { shareId, serializedConnectionMessage },
      }
      baseAdapter.send(authMessage)
    }

    const connection =
      context === 'anonymous'
        ? new AnonymousConnection({
            shareId,
            sendMessage,
          })
        : new Auth.Connection({
            context,
            sendMessage,
          })

    // Track the connection
    this.#log('setting connection %o', { shareId, peerId })
    this.#connections.set([shareId, peerId], connection)

    connection
      .on('joined', async ({ team, user }) => {
        // When we successfully join a team, the connection gives us the team graph and the user's
        // info (including keys). (When we're joining as a new device for an existing user, this
        // is how we get the user's keys.)

        if (user !== this.#user) this.#log = this.#log.extend(user.userName)

        // Create a share with this team
        this.#user = user

        await this.addTeam(team)

        await this.#saveState()

        // remove the used invitation as we no longer need it & don't want to present it to others
        this.#invitations.delete(shareId)

        // Let the application know
        this.emit('joined', { shareId, peerId, team, user })
      })

      .on('connected', () => {
        // Let the application know
        this.emit('connected', { shareId, peerId })
        // Let the repo know we've got a new peer
        authAdapter.emit('peer-candidate', { peerId, peerMetadata: {} })
      })

      .on('message', message => {
        // Forward messages that arrive via the connection's encrypted channel to the repo
        authAdapter.emit('message', message as Message)
      })

      .on('updated', async () => {
        // Team state has changed, so save our entire state
        await this.#saveState()
      })

      .on('localError', event => {
        // These are errors that are detected locally, e.g. a peer tries to join with an invalid
        // invitation
        this.#log(`localError: ${JSON.stringify(event)}`)

        // Let the application know, e.g. to let me decide if I want to allow the peer to retry
        this.emit('localError', { shareId, peerId, ...event })
      })

      .on('remoteError', event => {
        // These are errors that are detected on the peer and reported to us, e.g. a peer rejects
        // an invitation we tried to join with
        this.#log(`remoteError: ${JSON.stringify(event)}`)

        // Let the application know, e.g. to let me retry
        this.emit('remoteError', { shareId, peerId, ...event })
      })

      .on('disconnected', event => {
        this.#disconnect(shareId, peerId, event)
      })

    connection.start()

    // If we already had messages for this peer, pass them to the connection
    for (const message of this.#getStoredMessages(shareId, peerId)) connection.deliver(message)

    // Track the connection
    this.#connections.set([shareId, peerId], connection)

    // TODO: await connected?
  }

  #addPeer(baseAdapter: NetworkAdapter, peerId: PeerId) {
    this.#log('adding peer %o', peerId)

    // Track each peer by the adapter uses to connect to it
    const peers = this.#peers.get(baseAdapter) ?? []
    if (!peers.includes(peerId)) {
      peers.push(peerId)
      this.#peers.set(baseAdapter, peers)
    }
  }

  #disconnect(shareId: ShareId, peerId: PeerId, event?: Auth.ConnectionMessage) {
    this.#removeConnection(shareId, peerId)

    // Let the application know
    this.emit('disconnected', { shareId, peerId, event })

    // Let the repo know
    for (const authAdapter of this.#adapters) {
      // Find the adapter that has this peer
      const peers = this.#peers.get(authAdapter.baseAdapter) ?? []
      if (peers.includes(peerId)) {
        authAdapter.emit('peer-disconnected', { peerId })
        break
      }
    }
  }

  #getConnection(shareId: ShareId, peerId: PeerId) {
    const connection = this.#connections.get([shareId, peerId])
    if (!connection) throw new Error(`Connection not found for peer ${peerId} on share ${shareId}`)
    return connection
  }

  #removeConnection(shareId: ShareId, peerId: PeerId) {
    const connection = this.#connections.get([shareId, peerId])
    if (connection && connection.state !== 'disconnected') {
      connection.stop()
      this.#connections.delete([shareId, peerId])
    }
  }

  /** Saves a serialized and partially encrypted version of the state */
  async #saveState() {
    const shares = {} as SerializedState
    for (const share of this.#shares.values()) {
      const { shareId } = share
      const documentIds = Array.from(share.documentIds ?? [])
      shares[shareId] = isPrivateShare(share)
        ? ({
            shareId,
            encryptedTeam: share.team.save(),
            encryptedTeamKeys: encryptBytes(share.team.teamKeyring(), this.#device.keys.secretKey),
            documentIds,
          } as SerializedShare)
        : { shareId, documentIds }
    }
    const serializedState = pack(shares)

    await this.storage.save(STORAGE_KEY, serializedState)
  }

  /** Loads and decrypts state from its serialized, persisted form */
  async #loadState() {
    const serializedState = await this.storage.load(STORAGE_KEY)
    if (!serializedState) return

    const savedShares = unpack(serializedState) as SerializedState

    await Promise.all(
      Object.values(savedShares).map(async share => {
        if ('encryptedTeam' in share) {
          const { shareId, encryptedTeam, encryptedTeamKeys } = share
          this.#log('loading state', shareId)

          const teamKeys = decryptBytes(
            encryptedTeamKeys,
            this.#device.keys.secretKey
          ) as Auth.KeysetWithSecrets

          const context = { device: this.#device, user: this.#user }

          const team = await Auth.loadTeam(encryptedTeam, context, teamKeys)
          return this.addTeam(team)
        } else {
          return this.addPublicShare(share.shareId)
        }
      })
    )
  }

  #allShareIds() {
    return [...this.#shares.keys(), ...this.#invitations.keys()]
  }

  #getContextForShare(shareId: ShareId) {
    const device = this.#device
    const user = this.#user
    const invitation = this.#invitations.get(shareId)
    const share = this.#shares.get(shareId)
    if (share) {
      if (!isPrivateShare(share)) {
        return 'anonymous'
      }

      // this is a share we're already a member of
      return {
        device,
        user,
        team: share.team,
      } as Auth.MemberContext
    } else if (invitation)
      if (isDeviceInvitation(invitation))
        // this is a share we've been invited to as a device
        return {
          device,
          ...invitation,
        } as Auth.InviteeDeviceContext
      else {
        // this is a share we've been invited to as a member
        return {
          device,
          user,
          ...invitation,
        } as Auth.InviteeMemberContext
      }

    // we don't know about this share
    throw new Error(`no context for ${shareId}`)
  }

  /** Go through all our peers and try to connect in case they're on the team */
  async #createConnectionsForShare(shareId: ShareId) {
    this.#log('createConnectionsForShare', shareId)
    await Promise.all(
      this.#adapters.map(async authAdapter => {
        const peerIds = this.#peers.get(authAdapter.baseAdapter) ?? []
        this.#log('creating connections for %o', peerIds)
        return peerIds.map(async peerId => {
          const connection = this.#connections.get([shareId, peerId])
          if (!connection) {
            return this.#createConnection({ shareId, peerId, authAdapter })
          }
        })
      })
    )
  }

  /** Returns the shareId to use for encrypting the given message */
  #getShareIdForMessage({ targetId }: Message) {
    // Since the raw network adapters don't know anything about ShareIds, when we're given a message
    // to encrypt and send out, we need to figure out which auth connection it belongs to, in order
    // to retrieve the right session key to use for encryption.

    // First we need to find all shareIds for which we have connections with the target peer

    // TODO:
    //
    // When the base network adapter gives the AuthProvider a peer candidate, the AuthProvider
    // optimistically tries to make an authenticated connection using every team it knows about. If
    // both peers are on a team, the auth connection succeeds; the other connections don't succeed
    // and are eventually cleaned up. But in the meantime, we have multiple connections for the
    // peer. So when Alice connects, for a short while the server will have one connection in
    // Alice's name for every team it knows about.
    //
    // When the repo wants to send a sync message to Alice, we don't currently have a really
    // principled way of choosing which auth connection to send it over; we just pick one
    // arbitrarily in that case.
    //
    // If Alice actually is on two teams and we have two authenticated connections with her, that's
    // OK -- it really doesn't matter which connection the messages goes through. But you do need to
    // choose a connection that is going to succeed, and the more teams the server knows about, the
    // lower our chances of picking the right one.
    //
    // This explains why we originally were only getting the failure when other tests were running -
    // not because they were changing the timing or anything, but because they were adding other
    // teams to the same sync server. It also explains why we couldn't reproduce the failure by
    // hand, because we were generally dealing with a fresh sync server that only knew about our
    // team.
    //
    // I've gotten the test to pass consistently by only choosing from connections that have already
    // succeeded. But that's a kind of brittle solution, because the repo could give you a message
    // for a peer while you're still authenticating.
    //
    // I think the principled way to solve this is to add a step before spinning up any auth
    // connections, where you say what team(s) you want to use to connect. If I'm Alice connecting
    // directly with Bob, we'll just each say all the teams we're on and then just connect on any
    // that we have in common. If I'm a sync server, I probably wouldn't give the full list of teams
    // I know about; instead I'd wait for the peer to tell me their teams, and I'd just repeat back
    // that list (assuming I'm on every team on the list). (Kind of analogous to the
    // "generous"/"okToAdvertise" business with documents.)
    const shareIdsForPeer = this.#allShareIds().filter(
      shareId =>
        this.#connections.has([shareId, targetId]) &&
        this.#getConnection(shareId, targetId).state === 'connected'
    )

    if (shareIdsForPeer.length === 0) {
      throw new Error(`No share found for peer ${targetId} `)
    }

    // Typically there should be exactly one shareId for a given peer
    if (shareIdsForPeer.length === 1) return shareIdsForPeer[0]

    // However it's possible to have multiple auth connections with the same peer (one for each
    // share we're both a member of). To figure out which one to use, we need to look at the
    // documentId. If the same documentId is included in multiple shares with the same peer, we can
    // use any of those session keys, but we need to pick one consistently.

    // TODO: use documentId to pick the right share
    // For now, just pick the lowest ShareId
    return shareIdsForPeer.sort()[0]
  }
}

const STORAGE_KEY = ['AuthProvider', 'shares']

export const asArray = <T>(x: T | T[]): T[] => (Array.isArray(x) ? x : [x])

type Config = {
  /** We always have the local device's info and keys */
  device: Auth.DeviceWithSecrets

  /** We have our user info, unless we're a new device using an invitation */
  user?: Auth.UserWithSecrets

  /** We need to be given some way to persist our state */
  storage: StorageAdapter

  /**
   * If we're using one or more sync servers, we provide their hostnames. The hostname should
   * include the domain, as well as the port (if any). It should not include the protocol (e.g.
   * `https://` or `ws://`) or any path (e.g. `/sync`). For example, `localhost:3000` or
   * `syncserver.mydomain.com`.
   */
  server?: string | string[]
}
