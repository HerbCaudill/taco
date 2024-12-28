import { type Action, type Link, type Graph } from '../graph/index.js'

export type InvalidResult = {
  isValid: false
  error: ValidationError
}

export type ValidResult = {
  isValid: true
}

export class ValidationError extends Error {
  public type: 'Hash graph validation error'
  public details?: unknown

  constructor(message: string, details?: any) {
    super()
    this.message = message
    this.details = details
  }
}

export type ValidationResult = ValidResult | InvalidResult

export type Validator = <A extends Action, C>(
  link: Link<A, C>,
  graph: Graph<A, C>
) => ValidationResult

export type ValidatorSet = Record<string, Validator>
