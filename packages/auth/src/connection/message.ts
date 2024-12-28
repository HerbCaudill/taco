import type { Base58, Hash, Keyring, SyncMessage as SyncPayload } from '@localfirst/crdx'
import type { Challenge, IdentityClaim } from './types.js'
import type { ErrorMessage, LocalErrorMessage } from './errors.js'

export type ReadyMessage = {
  type: 'REQUEST_IDENTITY'
}

export type DisconnectMessage = {
  type: 'DISCONNECT'
  payload?: {
    message: string
  }
}

export type RequestResendMessage = {
  type: 'REQUEST_RESEND'
  payload: {
    index: number
  }
}

// Identity

export type ClaimIdentityMessage = {
  type: 'CLAIM_IDENTITY'
  payload: IdentityClaim
}

export type ChallengeIdentityMessage = {
  type: 'CHALLENGE_IDENTITY'
  payload: {
    challenge: Challenge
  }
}

export type ProveIdentityMessage = {
  type: 'PROVE_IDENTITY'
  payload: {
    challenge: Challenge
    proof: Base58 // This is a signature
  }
}

export type AcceptIdentityMessage = {
  type: 'ACCEPT_IDENTITY'
}

export type RejectIdentityMessage = {
  type: 'REJECT_IDENTITY'
  payload: {
    message: string
  }
}

export type AcceptInvitationMessage = {
  type: 'ACCEPT_INVITATION'
  payload: {
    serializedGraph: Uint8Array
    teamKeyring: Keyring
  }
}
// Synchronization

export type SyncMessage = {
  type: 'SYNC'
  payload: SyncPayload
}

// Triggered locally when we detect that team has changed
export type LocalUpdateMessage = {
  type: 'LOCAL_UPDATE'
  payload: { head: Hash[] }
}

// Negotiation

export type SeedMessage = {
  type: 'SEED'
  payload: {
    encryptedSeed: Uint8Array
  }
}

// Communication

export type EncryptedMessage = {
  type: 'ENCRYPTED_MESSAGE'
  payload: Uint8Array
}

export type ConnectionMessage =
  | AcceptIdentityMessage
  | AcceptInvitationMessage
  | ChallengeIdentityMessage
  | ClaimIdentityMessage
  | DisconnectMessage
  | EncryptedMessage
  | ErrorMessage
  | LocalErrorMessage
  | LocalUpdateMessage
  | ProveIdentityMessage
  | ReadyMessage
  | SeedMessage
  | SyncMessage
  | RequestResendMessage
