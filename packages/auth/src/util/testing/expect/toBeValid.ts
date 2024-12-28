import { expect } from 'vitest'
import { type ValidationResult } from '../../types.js'

// ignore coverage
expect.extend({
  toBeValid(validation: ValidationResult) {
    if (validation.isValid) {
      return {
        message: () => 'expected validation not to pass',
        pass: true,
      }
    }

    return {
      message: () => validation.error.message,
      pass: false,
    }
  },
})
