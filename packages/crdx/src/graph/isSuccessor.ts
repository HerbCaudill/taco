import { type Action, type Link, type Graph } from './types.js'
import { type Hash } from '../util/index.js'
import { getSuccessorHashes } from './getSuccessors.js'

/** Returns true if `a` is a successor of `b` */
export const isSuccessor = <A extends Action, C>(
  graph: Graph<A, C>,
  a: Link<A, C>,
  b: Link<A, C>
): boolean => {
  return (
    a !== undefined &&
    b !== undefined &&
    a.hash in graph.links &&
    b.hash in graph.links &&
    getSuccessorHashes(graph, b.hash).includes(a.hash)
  )
}

export const isSuccessorHash = (graph: Graph<any, any>, a: Hash, b: Hash) =>
  getSuccessorHashes(graph, b).includes(a)
