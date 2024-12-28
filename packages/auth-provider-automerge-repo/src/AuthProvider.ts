import type {
  DocumentId,
  Message,
  NetworkAdapter,
  PeerId,
  StorageAdapterInterface,
} from '@automerge/automerge-repo'
import { EventEmitter } from '@herbcaudill/eventemitter42'
import * as Auth from '@localfirst/auth'
import { hash } from '@localfirst/crypto'
import { assert, debug, memoize, pause } from '@localfirst/shared'
import { type AbstractConnection } from './AbstractConnection.js'
import { AnonymousConnection } from './AnonymousConnection.js'
import { buildServerUrl } from './buildServerUrl.js'
import { getShareId } from './getShareId.js'
import { pack, unpack } from 'msgpackr'
import { isJoinMessage, type JoinMessage } from './types.js'
import { AuthenticatedNetworkAdapter as AuthNetworkAdapter } from './AuthenticatedNetworkAdapter.js'
import { CompositeMap } from './CompositeMap.js'
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
const log = debug.extend('auth-provider')

/**
 * This class is used to wrap automerge-repo network adapters so that they authenticate peers and
 * encrypt network traffic, using [localfirst/auth](https://github.com/local-first-web/auth).
 *
 * To use:
 *
 * 1. Create a AuthProvider, using the same storage adapter that the repo will use:
 *
 * ```ts
 * const storage = new SomeStorageAdapter()
 * const auth = new AuthProvider({ user, device, storage })
 * ```
 *
 * 2. Wrap your network adapter(s) with its `wrap` method.
 *
 *  ```ts
 * const adapter = new SomeNetworkAdapter()
 * const authenticatedAdapter = auth.wrap(adapter)
 * ```
 *
 * 3. Pass the wrapped adapters to the repo.
 *
 *  ```ts
 * const repo = new Repo({
 *   storage,
 *   network: [authenticatedAdapter],
 * })
 * ```
 */
export class AuthProvider extends EventEmitter<AuthProviderEvents> {
  readonly #device: Auth.DeviceWithSecrets
  #user?: Auth.UserWithSecrets
  readonly storage: StorageAdapterInterface

  readonly #adapters: Array<AuthNetworkAdapter<NetworkAdapter>> = []
  readonly #invitations = new Map<ShareId, Invitation>()
  readonly #shares = new Map<ShareId, Share>()
  readonly #connections = new CompositeMap<[ShareId, PeerId], AbstractConnection>()
  readonly #storedMessages = new CompositeMap<[ShareId, PeerId], Uint8Array[]>()
  readonly #peers = new Map<NetworkAdapter, PeerId[]>()
  readonly #server: string[]
  readonly #peerShareIdHashes = new Map<PeerId, Set<Auth.Base58>>()

  #log = log

  constructor({ device, user, storage, server = [] }: Config) {
    super()

    // We always are given the local device's info & keys
    this.#device = device

    // We might already have our user info, unless we're a new device using an invitation
    if (user?.userName) {
      this.#user = user
      this.#log = log.extend(user.userName)
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
   * This provider works by wrapping an automerge-repo network adapter. The wrapped adapter is
   * passed to the `Repo`, and it intercepts the base adapter's events and messages, authenticating
   * peers and encrypting traffic.
   *
   * For each new peer, we create a localfirst/auth connection and use it to mutually authenticate
   * before forwarding the peer-candidate event.
   */
  public wrap = (baseAdapter: NetworkAdapter) => {
    // All repo messages for this adapter are handled by the Auth.Connection, which encrypts them
    // and guarantees authenticity.
    const send = (message: Message) => {
      this.#log('sending message from connection %o', message)
      const shareId = this.#getShareIdForMessage(message)
      const connection = this.#getConnection(shareId, message.targetId)

      // wait for connection to be ready before sending
      const onceConnected = new Promise<void>(resolve => {
        if (connection.state === 'connected') resolve()
        else connection.once('connected', () => resolve())
      })

      onceConnected
        .then(() => connection.send(message))
        .catch(error => this.#log('error sending message from connection %o', error))
    }
    const authAdapter = new AuthNetworkAdapter(baseAdapter, send)

    baseAdapter

      .on('peer-candidate', async ({ peerId }) => {
        // Try to authenticate new peers; if we succeed, we forward the peer-candidate to the network subsystem

        // TODO: we need to store the storageId and isEphemeral in order to provide that info in the
        // peer-candidate event
        this.#log('peer-candidate %o', peerId)

        // Track each peer by the adapter used to connect to it
        const peers = this.#peers.get(authAdapter.baseAdapter) ?? []
        if (!peers.includes(peerId)) {
          peers.push(peerId)
          this.#peers.set(authAdapter.baseAdapter, peers)
          this.#peerShareIdHashes.set(peerId, new Set())
        }

        await this.#sendJoinMessage(authAdapter, peerId)
      })

      // Intercept any incoming messages and pass them to the Auth.Connection.
      .on('message', message => {
        this.#log('message from adapter %o', message)

        if (isJoinMessage(message)) {
          this.#receiveJoinMessage(authAdapter, message)
        } else if (isAuthMessage(message)) {
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
        } else {
          throw new Error(`Unhandled message type: ${message.type}}`)
        }
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
    baseAdapter.on('close', () => authAdapter.emit('close'))
    baseAdapter.on('peer-disconnected', payload => authAdapter.emit('peer-disconnected', payload))
    baseAdapter.on('close', () => authAdapter.emit('close'))

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
    assert(this.#user, 'Cannot create team as user is missing on AuthProvider')

    const team = Auth.createTeam(teamName, {
      device: this.#device,
      user: this.#user,
    })

    await this.registerTeam(team)
    return team
  }

  /**
   * Registers an existing team with all of our sync servers.
   *
   * The application only needs to call this if the team was created outside of this provider; if
   * the team was created with `createTeam`, it's already registered.
   */
  public async registerTeam(team: Auth.Team) {
    await this.addTeam(team)

    const registrations = this.#server.map(async server => {
      const { origin, hostname } = buildServerUrl(server)

      // get the server's public keys
      const response = await fetch(`${origin}/keys`)
      const keys = await response.json()

      // add the server's public keys to the team
      team.addServer({ host: hostname, keys })

      // register the team with the server
      await fetch(`${origin}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serializedGraph: team.save(),
          teamKeyring: team.teamKeyring(),
        }),
      })
    })
    await Promise.all(registrations)
  }

  /**
   * Creates a private share for a team we're already a member of.
   */
  public async addTeam(team: Auth.Team, teamKeyring = team.teamKeyring()) {
    const shareId = getShareId(team)

    if (this.hasTeam(shareId)) {
      this.#log(`not adding team ${shareId} as it already exists`)
      return
    }

    this.#log(`adding team ${shareId}`)

    this.#shares.set(shareId, {
      shareId,
      team,
      documentIds: new Set(),
      teamKeyring,
    })

    // persist our state now and whenever the team changes
    await this.#saveState()
    team.on('updated', async () => this.#saveState())

    // connect with any peers who also have this share
    await this.#createConnectionsForShare(shareId)
  }

  /**
   * Returns true if there is a private share with the given id.
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

    // If none of our peers has this shareId, we can't join now. If we're connected to a sync
    // server, this probably means the invitation code is invalid. In a purely peer-to-peer scenario
    // with no sync servers or other always-on peers, this could mean that no one on this team is
    // currently online and we need to try again later.
    const shareExists = () => this.#peersByShareId(shareId).length > 0
    if (!shareExists()) {
      // wait a moment and try again (helpful in tests where everything is being spun up at once)
      await pause(100)
      if (!shareExists()) {
        console.log('throwing invalid invitation code error')
        throw new AuthError('INVALID_INVITATION_CODE')
      }
    }

    this.#invitations.set(shareId, invitation)
    await this.#createConnectionsForShare(shareId)
  }

  /**
   * Creates a new public share that can be joined by anyone who knows the share ID, and registers
   * it with all of our sync servers.
   */
  public async createPublicShare(shareId: ShareId) {
    this.#log('joining public share %s', shareId)
    await this.registerPublicShare(shareId)
    await this.joinPublicShare(shareId)
  }

  /**
   * Registers a share with all of our sync servers.
   */
  public async registerPublicShare(shareId: ShareId) {
    const registrations = this.#server.map(async server => {
      const { origin } = buildServerUrl(server)

      await fetch(`${origin}/public-shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
      })
    })
    await Promise.all(registrations)
  }

  /**
   * Joins a public share that already exists.
   */
  public async joinPublicShare(shareId: ShareId) {
    this.#log('joining public share %s', shareId)
    const share = this.#shares.get(shareId)

    if (!share) {
      this.#shares.set(shareId, { shareId })
      await this.#saveState()
    }

    await this.#createConnectionsForShare(shareId)
  }

  public async removeShare(shareId: ShareId) {
    const share = this.#shares.get(shareId)

    if (!share) {
      this.#log('share %s not found', shareId)
      return
    }

    // disconnect from all connections for this share
    for (const key of this.#connections.keys()) {
      const [_shareId, _peerId] = key
      if (_shareId === shareId) {
        this.#removeConnection(_shareId, _peerId)
      }
    }

    // remove the share
    this.#shares.delete(shareId)
    await this.#saveState()
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
   * TODO: note that this can also be an anonymous share
   * An Auth.Connection executes the localfirst/auth protocol to authenticate a peer, negotiate a
   * shared secret key for the session, and sync up the team graph. This communication happens
   * over a network adapter that we've wrapped.
   */
  async #maybeCreateConnection<T extends NetworkAdapter>({
    shareId,
    peerId,
    authAdapter,
  }: {
    shareId: ShareId
    peerId: PeerId
    authAdapter: AuthNetworkAdapter<T>
  }) {
    if (!this.#peerShareIdHashes.get(peerId)!.has(hashShareId(shareId))) {
      this.#log('peer %o does not have share %o', peerId, shareId)
      return
    }

    if (this.#connections.has([shareId, peerId])) {
      this.#log('connection already exists for %o', { shareId, peerId })
      return
    }

    const { baseAdapter } = authAdapter

    // wait until the adapter is ready
    await new Promise<void>(resolve => {
      if (authAdapter.isReady) resolve()
      else baseAdapter.once('ready', () => resolve())
    })
    this.#log('creating connection %o', { shareId, peerId })

    const context = this.#getContextForShare(shareId)

    // The auth connection uses the base adapter as its network transport
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
        ? new AnonymousConnection({ shareId, sendMessage })
        : new Auth.Connection({ context, sendMessage })

    // Track the connection
    this.#log('setting connection %o', { shareId, peerId })
    this.#connections.set([shareId, peerId], connection)

    connection
      .on('joined', async ({ team, user, teamKeyring }) => {
        // When we successfully join a team, the connection gives us the team graph and the user's
        // info (including keys).

        // When we're joining as a new device for an existing user, this is how we get the user's id and keys.
        this.#user = user
        this.#log = log.extend(user.userName)

        // Create a share with this team and the full team keys
        await this.addTeam(team, teamKeyring)

        // remove the used invitation as we no longer need it & don't want to present it to others
        this.#invitations.delete(shareId)

        // Let the application know
        this.emit('joined', { shareId, peerId, team, user })
      })

      .on('connected', () => {
        // If this is an Auth connection, we've successfully authenticated.

        // Let the application know
        this.emit('connected', { shareId, peerId })

        // Let the repo know we've got a new peer
        authAdapter.emit('peer-candidate', { peerId, peerMetadata: {} })
      })

      .on('message', message => {
        // Forward messages that arrive via the connection's channel to the repo. In the case of an
        // Auth connection, these have been decrypted and authenticated.
        authAdapter.emit('message', message as Message)
      })

      .on('updated', async () => {
        // (Auth connection only) Team state has changed, so save our entire state.
        await this.#saveState()
      })

      .on('localError', event => {
        // (Auth connection only) These are errors that are detected locally, e.g. a peer tries to join with an invalid
        // invitation.
        this.#log(`localError: ${JSON.stringify(event)}`)

        // Let the application know, e.g. to let me decide if I want to allow the peer to retry
        this.emit('localError', { shareId, peerId, ...event })
      })

      .on('remoteError', event => {
        // (Auth connection only) These are errors that are detected on the peer and reported to us,
        // e.g. a peer rejects an invitation we tried to join with
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
  }

  /**
   * Send a list of our shareIds so we only try to connect on shares that we have in common. We send
   * this when we first connect with a peer, and whenever we add a new share.
   */
  async #sendJoinMessage(
    authAdapter: AuthNetworkAdapter<NetworkAdapter>,
    peerId: PeerId,
    shareIds = this.#allShareIds()
  ) {
    // omit shares for which we already have an active connection
    const newShareIds = shareIds.filter(
      shareId =>
        !(
          this.#connections.has([shareId, peerId]) &&
          this.#getConnection(shareId, peerId).state === 'connected'
        )
    )

    // don't send join message if we don't have any new shares to report
    if (newShareIds.length === 0) return

    const hashedShareIds = newShareIds.map(hashShareId)
    // Send a join message with a list of hashes of our shareIds.
    const joinMessage: JoinMessage = {
      type: 'join-shares',
      senderId: authAdapter.baseAdapter.peerId!,
      targetId: peerId,
      shareIdHashes: hashedShareIds,
    }

    this.#log('sending join message %o', joinMessage)
    await pause(1)
    authAdapter.baseAdapter.send(joinMessage)
  }

  /**
   * Any time we receive shareIds from a peer, we add them to a list of shareIds that we keep for
   * each peer, and create connections for any shares that we have in common.
   */
  #receiveJoinMessage(authAdapter: AuthNetworkAdapter<NetworkAdapter>, message: JoinMessage) {
    this.#log('received join message %o', message)
    const { senderId, shareIdHashes } = message

    // make a map of hashed shareIds to our shareIds
    const ourHashes = new Map(
      this.#allShareIds().map(shareId => {
        return [hashShareId(shareId), shareId]
      })
    )

    const theirHashes = this.#peerShareIdHashes.get(senderId)! // this is created when we first see a peer
    for (const hash of shareIdHashes) {
      theirHashes.add(hash)
      const shareId = ourHashes.get(hash)
      if (shareId) {
        this.emit('peer-joined', { shareId, peerId: senderId })
        void this.#maybeCreateConnection({ shareId, peerId: senderId, authAdapter })
      }
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
            encryptedTeamKeys: encryptBytes(
              { ...share.teamKeyring, ...share.team.teamKeyring() },
              this.#device.keys.secretKey
            ),
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

    assert(this.#user, 'Cannot load state as user is missing on AuthProvider')

    await Promise.all(
      Object.values(savedShares).map(async share => {
        if ('encryptedTeam' in share) {
          const { shareId, encryptedTeam, encryptedTeamKeys } = share
          this.#log('loading state', shareId)

          const teamKeys = decryptBytes(
            encryptedTeamKeys,
            this.#device.keys.secretKey
          ) as Auth.KeysetWithSecrets

          // By this point it is defined
          assert(this.#user)

          const context: Auth.LocalContext = { device: this.#device, user: this.#user }

          const team = Auth.loadTeam(encryptedTeam, context, teamKeys)
          return this.addTeam(team)
        } else {
          return this.joinPublicShare(share.shareId)
        }
      })
    )
  }

  #allShareIds() {
    return [...this.#shares.keys(), ...this.#invitations.keys()]
  }

  #peersByShareId(shareId: ShareId) {
    const hash = hashShareId(shareId)
    const peers: PeerId[] = []
    for (const [peerId, hashes] of this.#peerShareIdHashes) {
      if (hashes.has(hash)) peers.push(peerId)
    }
    return peers
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

  /**
   * Let our peers know that we're interested in this share, and connect with any peers that have
   * already said they are interested in it.
   */
  async #createConnectionsForShare(shareId: ShareId) {
    this.#log('createConnectionsForShare', shareId)

    await Promise.all(
      this.#adapters.flatMap(async authAdapter => {
        const peerIds = this.#peers.get(authAdapter.baseAdapter) ?? []
        this.#log('creating connections for %o', peerIds)
        return peerIds.map(async peerId => {
          await this.#sendJoinMessage(authAdapter, peerId, [shareId])
          return this.#maybeCreateConnection({ shareId, peerId, authAdapter })
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

    const shareIdsForPeer = this.#allShareIds().filter(shareId =>
      this.#connections.has([shareId, targetId])
    )

    if (shareIdsForPeer.length === 0) {
      throw new Error(`No share found for peer ${targetId} `)
    }

    // However it's possible to have multiple auth connections with the same peer (one for each
    // share we're both a member of). To figure out which one to use, we need to look at the
    // documentId. If the same documentId is included in multiple shares with the same peer, we can
    // use any of those session keys, but we need to pick one consistently.

    // TODO: use documentId to pick the right share
    // For now, just pick the lowest ShareId
    return shareIdsForPeer.sort()[0]
  }
}

const STORAGE_KEY = ['localfirst-auth', 'auth-provider-automerge-repo', 'shares']

const asArray = <T>(x: T | T[]): T[] => (Array.isArray(x) ? x : [x])

const hashShareId = memoize((shareId: ShareId) => {
  return hash('HASH_SHARE_ID', shareId)
})

// TYPES

type Config = {
  /** We always have the local device's info and keys */
  device: Auth.DeviceWithSecrets

  /** We have our user info, unless we're a new device using an invitation */
  user?: Auth.UserWithSecrets

  /** We need to be given some way to persist our state */
  storage: StorageAdapterInterface

  /**
   * If we're using one or more sync servers, we provide their hostnames. The hostname should
   * include the domain, as well as the port (if any). If you don't include a protocol, we'll
   * assume you want to use http. Any path (e.g. `/sync`) will be ignored.
   * For example, `localhost:3000` or `https://syncserver.mydomain.com`.
   */
  server?: string | string[]
}

export class AuthError extends Error {
  name: AuthErrorType
  constructor(type: AuthErrorType) {
    const message = AuthErrorMessage[type]
    super(`Authentication error: ${message}`)
    this.name = type
  }
}

export const AuthErrorMessage = {
  INVALID_INVITATION_CODE: 'Invalid invitation code',
  ENCRYPTION_FAILURE: 'Encryption failure',
}

export type AuthErrorType = keyof typeof AuthErrorMessage
