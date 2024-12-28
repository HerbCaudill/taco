import { type Hash } from '../util/index.js'

export const headsAreEqual = (a: Hash[] | undefined, b: Hash[] | undefined) => {
  if (a === undefined || b === undefined) return false
  if (a.length !== b.length) return false

  a.sort()
  b.sort()
  return a.every((hash, i) => hash === b[i])
}
