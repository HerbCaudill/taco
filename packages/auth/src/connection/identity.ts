import {
  type Base58,
  type KeyScope,
  type KeysetWithSecrets,
  type Keyset,
  type UnixTimestamp,
} from '@localfirst/crdx'
import { signatures, randomKey } from '@localfirst/crypto'
import { type Challenge } from './types.js'
import { VALID, type ValidationResult } from '../util/index.js'

export const challenge = (identityClaim: KeyScope): Challenge => ({
  ...identityClaim,
  nonce: randomKey(),
  timestamp: Date.now() as UnixTimestamp,
})

export const prove = (challenge: Challenge, keys: KeysetWithSecrets): Base58 =>
  signatures.sign(challenge, keys.signature.secretKey)

export const verify = (
  challenge: Challenge,
  signature: Base58,
  publicKeys: Keyset
): ValidationResult => {
  const details = { challenge, signature }

  const signatureIsValid = signatures.verify({
    payload: challenge,
    signature,
    publicKey: publicKeys.signature,
  })
  if (!signatureIsValid) {
    return fail('Signature is not valid', details)
  }

  return VALID
}

const fail = (message: string, details: any) =>
  ({
    isValid: false,
    error: new IdentityChallengeFailure(message, details),
  }) as ValidationResult

export class IdentityChallengeFailure extends Error {
  constructor(message: string, details?: any) {
    super()
    this.name = 'Identity challenge failed'
    this.message = message + '\n' + JSON.stringify(details, null, 2).replaceAll('"', '')
    this.details = details
  }

  public details?: any
}
