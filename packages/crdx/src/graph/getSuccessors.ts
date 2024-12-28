import { memoize } from '@localfirst/shared'
import { uniq } from 'lodash-es'
import { type Hash } from '../util/index.js'
import { getChildrenHashes } from './children.js'
import type { Action, Graph, Link } from './types.js'

const memoizeResolver = (graph: Graph<any, any>, hash: Hash) => `${graph.head.join('')}:${hash}`

export const getSuccessorHashes = memoize((graph: Graph<any, any>, hash: Hash): Hash[] => {
  const children = getChildrenHashes(graph, hash)
  const successors = children.flatMap(parent => getSuccessorHashes(graph, parent))
  return uniq(children.concat(successors))
}, memoizeResolver)

/** Returns the set of successors of `link` (not including `link`) */
export const getSuccessors = <A extends Action, C>(
  graph: Graph<A, C>,
  link: Link<A, C>
): Array<Link<A, C>> =>
  getSuccessorHashes(graph, link.hash)
    .map(h => graph.links[h])
    .filter(link => link !== undefined)
