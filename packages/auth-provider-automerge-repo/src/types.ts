import type { DocumentId, Message, PeerId } from '@automerge/automerge-repo'
import type * as Auth from '@localfirst/auth'

// SHARES

/**
 * The share ID is an arbitrary string for public (anonymous) shares, and the truncated team ID for
 * private (authenticated) shares (see `getShareId`).
 */
export type ShareId = Auth.Hash & { __shareId: true }

/**
 * A share represents a set of users who have access to some set of documents. There are two types
 * of shares:
 * - A public share is a share that is not associated with a team. It is identified by a share
 *   ID, which is an arbitrary string. Its documents are available to anyone who has the share ID.
 * - A private share is a share that is associated with a {@link Auth.Team}. It is
 *   identified by the team ID, and its documents are only available to team members. The team can
 *   be queried for users, roles, keys, etc.
 */
export type Share = PublicShare | PrivateShare

export type PublicShare = {
  /**
   * The share ID is an arbitrary string for public (anonymous) shares, and the truncated team ID
   * for private (authenticated) shares.
   */
  shareId: ShareId

  /** If no document IDs are specified, then all documents are assumed to be shared. */
  documentIds?: Set<DocumentId>
}

export type PrivateShare = PublicShare & {
  /** The team that is used for enforcing authenticated access to this share */
  team: Auth.Team
  teamKeyring: Auth.Keyring
}

export const isPrivateShare = (share: Share): share is PrivateShare =>
  'team' in share && share.team !== undefined

/** To save our state, we serialize each share. */
export type SerializedState = Record<ShareId, SerializedShare>

export type SerializedShare = SerializedPublicShare | SerializedPrivateShare

export type SerializedPublicShare = {
  shareId: ShareId
  documentIds: DocumentId[]
}

export type SerializedPrivateShare = SerializedPublicShare & {
  encryptedTeam: Uint8Array
  encryptedTeamKeys: Uint8Array
}

// INVITATIONS

/**
 * There are two ways for a device to join a team with an invitation:
 *
 * - If we're a new member joining a team for the first time, we just provide the share ID (which is
 *   the team ID) and the secret invitation code we were given.
 * - If we're a new device being added by an existing member, we also provide the user's name and
 *   ID.
 */
export type Invitation = DeviceInvitation | MemberInvitation

export type MemberInvitation = {
  shareId: ShareId
  invitationSeed: string
}

export type DeviceInvitation = MemberInvitation & {
  userName: string
}

export const isDeviceInvitation = (invitation: Invitation): invitation is DeviceInvitation => {
  return 'userName' in invitation && 'userId' in invitation
}

// MESSAGES

/** Sent by an {@link AuthProvider} to authenticate a peer */
export type AuthMessage<TPayload = any> = {
  type: 'auth'

  /** The peer ID of the sender of this message */
  senderId: PeerId

  /** The peer ID of the recipient of this message */
  targetId: PeerId

  /** The payload of the auth message (up to the specific auth provider) */
  payload: TPayload
}

export type LocalFirstAuthMessagePayload = {
  shareId: ShareId
  serializedConnectionMessage: Uint8Array
}

export type LocalFirstAuthMessage = AuthMessage<LocalFirstAuthMessagePayload>

export type EncryptedMessage = {
  type: 'encrypted'
  senderId: PeerId
  targetId: PeerId
  shareId: ShareId
  encryptedMessage: Auth.Base58
}

export const isEncryptedMessage = (
  message: Message | EncryptedMessage
): message is EncryptedMessage => message.type === 'encrypted'

export const isAuthMessage = (msg: any): msg is AuthMessage => msg.type === 'auth'

// EVENTS

export type ErrorPayload = Auth.ConnectionErrorPayload & {
  shareId: ShareId
  peerId: PeerId
}

export type AuthProviderEvents = {
  /** We've loaded any persisted state so for example you can ask for a team */
  ready: () => void

  /**
   * We've successfully joined a team using an invitation. This event provides the team graph and
   * the user's info (including keys). (When we're joining as a new device for an existing user,
   * this is how we get the user's keys.) This event gives the application a chance to persist the
   * team graph and the user's info.
   */
  joined: (payload: {
    shareId: ShareId
    peerId: PeerId
    team: Auth.Team
    user: Auth.UserWithSecrets
  }) => void

  /**
   * We're connected to a peer and have been mutually authenticated.
   */
  connected: (payload: { shareId: ShareId; peerId: PeerId }) => void

  /**
   * A peer has let us know that they are interested in a shareId.
   */
  'peer-joined': (payload: { shareId: ShareId; peerId: PeerId }) => void

  /**
   * We've detected an error locally, e.g. a peer tries to join with an invalid invitation.
   */
  localError: (payload: ErrorPayload) => void

  /**
   * Our peer has detected an error and reported it to us, e.g. we tried to join with an invalid
   * invitation.
   */
  remoteError: (payload: ErrorPayload) => void

  /**
   * The auth connection disconnects from a peer after entering an error state.
   */
  disconnected: (payload: {
    shareId: ShareId
    peerId: PeerId
    event?: Auth.ConnectionMessage
  }) => void
}

export type JoinMessage = Message & {
  type: 'join-shares'
  shareIdHashes: Auth.Base58[]
}

export const isJoinMessage = (message: Message): message is JoinMessage =>
  message.type === 'join-shares'
