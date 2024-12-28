import { memoize } from '@localfirst/shared'
import { signatures } from '@localfirst/crypto'
import { type Invitation, type InvitationState, type ProofOfInvitation } from './types.js'
import { VALID, type ValidationResult } from '../util/index.js'

export const invitationCanBeUsed = (invitation: InvitationState, timeOfUse: number) => {
  const { revoked, maxUses, uses, expiration } = invitation
  if (revoked) {
    return fail('The invitation has been revoked')
  }

  if (maxUses > 0 && uses >= maxUses) {
    return fail('The invitation cannot be used again')
  }

  if (expiration > 0 && expiration < timeOfUse) {
    return fail('The invitation has expired')
  }

  return VALID
}

export const validate = memoize(
  (proof: ProofOfInvitation, invitation: Invitation): ValidationResult => {
    const { id, signature } = proof

    // Check that id from proof matches invitation
    if (id !== invitation.id) {
      return fail("IDs don't match", { proof, invitation })
    }

    // Check signature on proof against public key from invitation
    const { publicKey } = invitation
    const signatureIsValid = signatures.verify({
      payload: { id },
      signature,
      publicKey,
    })
    if (!signatureIsValid) {
      return fail('Signature provided is not valid', { proof, invitation })
    }

    return VALID
  }
)

export const fail = (message: string, details?: any) =>
  ({
    isValid: false,
    error: new InvitationValidationError(message, details),
  }) as ValidationResult

export class InvitationValidationError extends Error {
  constructor(message: string, details?: any) {
    super()
    this.name = 'Invitation validation failed'
    this.message = message
    this.details = details
  }

  public index?: number
  public details?: any
}
