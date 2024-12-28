import { assert, memoize } from '@localfirst/shared'
import { uniq } from 'lodash-es'
import { type Hash } from '../util/index.js'
import { getLink } from './getLink.js'
import type { Action, Graph, Link } from './types.js'

export const memoizeResolver = (graph: Graph<any, any>, hash: Hash) =>
  `${graph.head.join('')}:${hash}`

/** Returns the set of predecessors of `link` (not including `link`) */
export const getPredecessors = <A extends Action, C>(
  graph: Graph<A, C>,
  link: Link<A, C>
): Array<Link<A, C>> =>
  getPredecessorHashes(graph, link.hash)
    .map(h => graph.links[h])
    .filter(link => link !== undefined)

export const getPredecessorHashes = memoize((graph: Graph<any, any>, hash: Hash): Hash[] => {
  const link = getLink(graph, hash)
  assert(link)
  const parents = link.body.prev as Hash[]
  const predecessors = parents.flatMap(parent => getPredecessorHashes(graph, parent))
  return uniq(parents.concat(predecessors))
}, memoizeResolver)
