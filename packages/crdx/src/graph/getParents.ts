import type { Action, Link, Graph } from './types.js'
import type { Hash } from '../util/index.js'
import { getLink } from './getLink.js'

// prettier-ignore
export function getParents<A extends Action, C>(graph: Graph<A, C>, link: Link<A, C>): Array<Link<A, C>>
export function getParents(graph: Graph<any, any>, hash: Hash): Hash[]
/**
 * Get the parents of a link. You can pass the link itself or its hash.
 */
export function getParents<A extends Action, C>(graph: Graph<A, C>, linkOrHash: Link<A, C> | Hash) {
  if (typeof linkOrHash === 'string') {
    const hash: Hash = linkOrHash
    const link = getLink(graph, hash)
    return link.body.prev
  } else {
    const link: Link<A, C> = linkOrHash
    return link.body.prev.map(hash => getLink(graph, hash))
  }
}
