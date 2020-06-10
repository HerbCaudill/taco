﻿import { Base64, Base64Keypair } from '/util'

export interface Keyset {
  encryption: Base64Keypair
  signature: Base64Keypair
}

/**
 * Represents the scope of a keyset. Could be:
 * - an entire team: `{type: TEAM, name: TEAM}`
 * - a specific role: `{type: ROLE, name: 'admin'}`
 * - a specific member: `{type: MEMBER, name: 'alice'}`
 * - a specific device: `{type: DEVICE, name: 'alice laptop'}`
 * - a single-use keyset: `{type: EPHEMERAL, name: EPHEMERAL}`
 */
export interface KeyScope {
  type: KeyType
  name: string
}

export enum KeyType {
  TEAM = 'TEAM',
  ROLE = 'ROLE',
  MEMBER = 'MEMBER',
  DEVICE = 'DEVICE',
  EPHEMERAL = 'EPHEMERAL',
}

export interface KeyMetadata extends KeyScope {
  generation: number
}

export interface KeysetWithSecrets extends KeyMetadata, Keyset {}

export interface PublicKeyset extends KeyMetadata {
  encryption: Base64 // = encryption.publicKey
  signature: Base64 // = signature.publicKey
}

// type guard: PublicKeys vs KeysWithSecrets
export const hasSecrets = (keys: PublicKeyset | KeysetWithSecrets): keys is KeysetWithSecrets =>
  keys.encryption.hasOwnProperty('secretKey') || keys.signature.hasOwnProperty('secretKey')
