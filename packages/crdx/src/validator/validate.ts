import { memoize } from '@localfirst/shared'
import { type ValidationResult, type ValidatorSet } from './types.js'
import { fail, validators } from './validators.js'
import { VALID } from '../constants.js'
import { hashEncryptedLink } from '../graph/hashLink.js'
import { type Action, type Link, type Graph } from '../graph/types.js'
import { hash } from '@localfirst/crypto'

/**
 * Runs a hash graph through a series of validators to ensure that it is correctly formed, has
 * not been tampered with, etc.
 */
const _validate = <A extends Action, C>(
  /** The hash graph to validate. */
  graph: Graph<A, C>,

  /** Any additional validators (besides the base validators that test the graph's integrity) */
  customValidators: ValidatorSet = {}
): ValidationResult => {
  // Confirm that the root hash matches the computed hash of the root link
  {
    const rootHash = graph.root
    const rootLink = graph.encryptedLinks[rootHash]
    const computedHash = hashEncryptedLink(rootLink.encryptedBody)
    if (computedHash !== rootHash)
      return fail('Root hash does not match the hash of the root link', {
        rootHash,
        computedHash,
        rootLink,
      })
  }

  // Confirm that each head hash matches the computed hash of the head link
  for (const headHash of graph.head) {
    const headLink = graph.encryptedLinks[headHash]
    const computedHash = hashEncryptedLink(headLink.encryptedBody)
    if (computedHash !== headHash)
      return fail('Head hash does not match the hash of the head link', {
        headHash,
        computedHash,
        headLink,
      })
  }

  // Confirm that there is an encrypted link for each link in the graph and vice versa
  const encryptedLinkHashes = Object.keys(graph.encryptedLinks)
  const linkHashes = Object.keys(graph.links)
  if (encryptedLinkHashes.length !== linkHashes.length)
    return fail('Number of encrypted links does not match number of links', {
      encryptedLinkHashes,
      linkHashes,
    })

  // Returns a single reducer function that runs all validators.
  const composeValidators =
    (...validators: ValidatorSet[]) =>
    (currentLink: Link<A, C>) => {
      const mergedValidators = merge(validators)
      for (const key in mergedValidators) {
        const validator = mergedValidators[key]
        try {
          const result = validator(currentLink, graph)
          if (!result.isValid) return result
        } catch (error) {
          // any errors thrown cause validation to fail and are returned with the validation result
          // ignore coverage
          const { message } = error as Error
          return fail(message, error)
        }
      }

      return VALID
    }

  const compositeValidator = composeValidators(validators, customValidators)
  for (const link of Object.values(graph.links)) {
    const result = compositeValidator(link)
    if (!result.isValid) return result
  }

  return VALID
}

export const validate = memoize(_validate, graph => hash('memoize', graph))

// merges multiple validator sets into one object
const merge = (validatorSets: ValidatorSet[]) =>
  validatorSets.reduce((result, vs) => Object.assign(result, vs), {})
