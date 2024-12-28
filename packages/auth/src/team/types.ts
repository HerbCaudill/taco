import type {
  Base58,
  Graph,
  Hash,
  KeyMetadata,
  Keyring,
  Keyset,
  KeysetWithSecrets,
  Link,
  LinkBody,
  Payload,
  ROOT,
  Sequence,
} from '@localfirst/crdx'
import type { Client, LocalContext } from './context.js'
import type { Device } from '../device/index.js'
import type { Invitation, InvitationState } from '../invitation/types.js'
import type { Lockbox } from '../lockbox/index.js'
import type { PermissionsMap, Role } from '../role/index.js'
import type { Host, Server } from '../server/index.js'
import type { ValidationResult } from '../util/index.js'

// ********* MEMBER

/** A member is a user that belongs to a team. */
export type Member = {
  /** Unique ID populated on creation. */
  userId: string

  /** Username (or email). Must be unique but is not used for lookups. Only provided to connect
   * human identities with other systems. */
  userName: string

  /** The member's public keys */
  keys: Keyset

  /** Array of role names that the member belongs to */
  roles: string[]

  /** Devices that the member has added, along with their public */
  devices?: Device[]
}

// ********* TEAM CONSTRUCTOR

/** Properties required when creating a new team */
export type NewTeamOptions = {
  /** The team's human-facing name */
  teamName: string

  /** The team keys need to be provided for encryption and decryption. It's up to the application to persist these somewhere.  */
  teamKeys: KeysetWithSecrets
}

/** Properties required when rehydrating from an existing graph  */
export type ExistingTeamOptions = {
  /** The `TeamGraph` representing the team's state, to be rehydrated.
   *  Can be serialized or not. */
  source: Uint8Array | TeamGraph

  /** The team keys need to be provided for encryption and decryption. It's up to the application to persist these somewhere.  */
  teamKeyring: Keyring
}

type NewOrExisting = NewTeamOptions | ExistingTeamOptions

/** Options passed to the `Team` constructor */
export type TeamOptions = NewOrExisting & {
  /** A seed for generating keys. This is typically only used for testing, to ensure predictable data. */
  seed?: string

  /** Object containing the current user and device (and optionally information about the client & version). */
  context: LocalContext
}

/** Type guard for NewTeamOptions vs ExistingTeamOptions  */
export const isNewTeam = (options: NewOrExisting): options is NewTeamOptions =>
  'teamName' in options

// ********* ACTIONS

type BasePayload = {
  // Every action might include new lockboxes
  lockboxes?: Lockbox[]
}

export type RootAction = {
  type: typeof ROOT
  payload: BasePayload & {
    name: string
    rootMember: Member
    rootDevice: Device
  }
}

export type AddMemberAction = {
  type: 'ADD_MEMBER'
  payload: BasePayload & {
    member: Member
    roles?: string[]
  }
}

export type RemoveMemberAction = {
  type: 'REMOVE_MEMBER'
  payload: BasePayload & {
    userId: string
  }
}

export type AddRoleAction = {
  type: 'ADD_ROLE'
  payload: BasePayload & Role
}

export type RemoveRoleAction = {
  type: 'REMOVE_ROLE'
  payload: BasePayload & {
    roleName: string
  }
}

export type AddMemberRoleAction = {
  type: 'ADD_MEMBER_ROLE'
  payload: BasePayload & {
    userId: string
    roleName: string
    permissions?: PermissionsMap
  }
}

export type RemoveMemberRoleAction = {
  type: 'REMOVE_MEMBER_ROLE'
  payload: BasePayload & {
    userId: string
    roleName: string
  }
}

export type AddDeviceAction = {
  type: 'ADD_DEVICE'
  payload: BasePayload & {
    device: Device
  }
}

export type RemoveDeviceAction = {
  type: 'REMOVE_DEVICE'
  payload: BasePayload & {
    deviceId: string
  }
}

export type InviteMemberAction = {
  type: 'INVITE_MEMBER'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export type InviteDeviceAction = {
  type: 'INVITE_DEVICE'
  payload: BasePayload & {
    invitation: Invitation
  }
}

export type RevokeInvitationAction = {
  type: 'REVOKE_INVITATION'
  payload: BasePayload & {
    id: string // Invitation ID
  }
}

export type AdmitMemberAction = {
  type: 'ADMIT_MEMBER'
  payload: BasePayload & {
    id: Base58 // Invitation ID
    userName: string
    memberKeys: Keyset // Member keys provided by the new member
  }
}

export type AdmitDeviceAction = {
  type: 'ADMIT_DEVICE'
  payload: BasePayload & {
    id: Base58 // Invitation ID
    device: Device
  }
}

export type ChangeMemberKeysAction = {
  type: 'CHANGE_MEMBER_KEYS'
  payload: BasePayload & {
    keys: Keyset
  }
}

export type RotateKeysAction = {
  type: 'ROTATE_KEYS'
  payload: BasePayload & {
    userId: string
  }
}

export type AddServerAction = {
  type: 'ADD_SERVER'
  payload: BasePayload & {
    server: Server
  }
}

export type RemoveServerAction = {
  type: 'REMOVE_SERVER'
  payload: BasePayload & {
    host: Host
  }
}

export type ChangeServerKeysAction = {
  type: 'CHANGE_SERVER_KEYS'
  payload: BasePayload & {
    keys: Keyset
  }
}

export type MessageAction = {
  type: 'MESSAGE'
  payload: BasePayload & {
    message: unknown
  }
}

export type SetTeamNameAction = {
  type: 'SET_TEAM_NAME'
  payload: BasePayload & {
    teamName: string
  }
}

export type TeamAction =
  | RootAction
  | AddMemberAction
  | AddDeviceAction
  | AddRoleAction
  | AddMemberRoleAction
  | RemoveMemberAction
  | RemoveDeviceAction
  | RemoveRoleAction
  | RemoveMemberRoleAction
  | InviteMemberAction
  | InviteDeviceAction
  | RevokeInvitationAction
  | AdmitMemberAction
  | AdmitDeviceAction
  | ChangeMemberKeysAction
  | RotateKeysAction
  | AddServerAction
  | RemoveServerAction
  | ChangeServerKeysAction
  | MessageAction
  | SetTeamNameAction

export type TeamContext = {
  deviceId: string
  client?: Client
}

export type TeamLinkBody = LinkBody<TeamAction, TeamContext>

export type TeamLink = Link<TeamAction, TeamContext> & {
  isInvalid?: boolean
}

export type TeamLinkMap = Record<Hash, TeamLink>
export type TeamGraph = Graph<TeamAction, TeamContext>
export type Branch = Sequence<TeamAction, TeamContext>
export type TwoBranches = [Branch, Branch]
export type MembershipRuleEnforcer = (links: TeamLink[], graph: TeamGraph) => TeamLink[]

// ********* TEAM STATE

export type TeamState = {
  head: Hash[]

  teamName: string
  rootContext?: TeamContext
  members: Member[]
  roles: Role[]
  servers: Server[]
  lockboxes: Lockbox[]
  invitations: InvitationMap
  messages: unknown[]

  // We keep track of removed members and devices primarily so that we deliver the correct message
  // to them when we refuse to connect
  removedMembers: Member[]
  removedDevices: Device[]
  removedServers: Server[]

  // If a member's admission is reversed, we need to flag them as compromised so an admin can
  // rotate any keys they had access to at the first opportunity
  pendingKeyRotations: string[]
}

export type InvitationMap = Record<string, InvitationState>

// ********* VALIDATION

export type TeamStateValidator = (previousState: TeamState, link: TeamLink) => ValidationResult

export type TeamStateValidatorSet = Record<string, TeamStateValidator>

export type ValidationArgs = [TeamState, TeamLink]

// ********* CRYPTO

export type EncryptedEnvelope = {
  contents: Uint8Array
  recipient: KeyMetadata
}

export type SignedEnvelope = {
  contents: Payload
  signature: Base58
  author: KeyMetadata
}

export type Transform = (state: TeamState) => TeamState
export type InviteResult = {
  /** The unique identifier for this invitation. */
  id: Base58

  /** The secret invitation key. (Returned in case it was generated randomly.) */
  seed: string
}
export type LookupIdentityResult =
  | 'VALID_DEVICE'
  | 'MEMBER_REMOVED'
  | 'DEVICE_UNKNOWN'
  | 'DEVICE_REMOVED'
