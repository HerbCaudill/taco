import { type ValidationResult } from './types.js'

// avoiding enums
export const SIGNATURE = 'SIGNATURE'
export const ENCRYPTION = 'ENCRYPTION'
export const SYMMETRIC = 'SYMMETRIC'
export const LINK_HASH = 'LINK_HASH'
export const LINK_TO_PREVIOUS = 'LINK_TO_PREVIOUS'
export const INVITATION = 'INVITATION'
export const DEVICE_ID = 'DEVICE_ID'
export const SHARED_KEY = 'SHARED_KEY'

export const HashPurpose = {
  SIGNATURE,
  ENCRYPTION,
  SYMMETRIC,
  LINK_HASH,
  LINK_TO_PREVIOUS,
  INVITATION,
  DEVICE_ID,
  SHARED_KEY,
} as const

export const VALID: ValidationResult = { isValid: true }
