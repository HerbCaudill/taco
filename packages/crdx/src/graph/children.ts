import { memoize } from '@localfirst/shared'
import type { Action, Graph, Link } from './types.js'
import { type Hash } from '../util/index.js'
import { getLink } from './getLink.js'

/**
 * Returns the hashes of the children of the link with the given hash.
 */
export const getChildrenHashes = <A extends Action, C>(graph: Graph<A, C>, hash: Hash): Hash[] => {
  const childrenLookup = calculateChildren(graph)
  return childrenLookup[hash] || []
}

export const getChildren = <A extends Action, C>(
  graph: Graph<A, C>,
  link: Link<A, C>
): Array<Link<A, C>> => {
  return getChildrenHashes(graph, link.hash).map(hash => getLink(graph, hash))
}

/**
 * Creates a lookup (by hash) containing the children of the corresponding link.
 *  ```
 * {
 *    hash: [childHash, childHash, ...],
 *    hash: [childHash, childHash, ...],
 * }
 * ```
 */
const calculateChildren = memoize(<A extends Action, C>(graph: Graph<A, C>) => {
  const childrenLookup = {} as Record<Hash, Hash[]>

  // find the parents of each link, and add them to a dictionary lookup
  for (const link of Object.values(graph.links)) {
    const parents = link.body.prev
    for (const parent of parents) {
      // add this link's hash to each parent's list of children
      const children = childrenLookup[parent] || []
      children.push(link.hash)
      childrenLookup[parent] = children
    }
  }

  return childrenLookup
})
