import { expect } from 'vitest'
import { type Keyset } from '../../../keyset/index.js'
// ignore file coverage
expect.extend({
  toLookLikeKeyset(maybeKeyset: Keyset | Record<string, unknown>) {
    const looksLikeKeyset =
      maybeKeyset.hasOwnProperty('encryption') && maybeKeyset.hasOwnProperty('signature')
    if (looksLikeKeyset)
      return {
        message: () => 'expected not to look like a keyset',
        pass: true,
      }
    return {
      message: () => 'expected to look like a keyset',
      pass: false,
    }
  },
})
