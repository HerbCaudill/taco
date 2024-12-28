import { type Graph, type Link } from './types.js'
import { type Hash } from '../util/index.js'
import { getPredecessorHashes } from './getPredecessors.js'

/** Returns true if `a` is a predecessor of `b` */
export const isPredecessor = (graph: Graph<any, any>, a: Link<any, any>, b: Link<any, any>) => {
  return (
    a !== undefined &&
    b !== undefined &&
    a.hash in graph.links &&
    b.hash in graph.links &&
    getPredecessorHashes(graph, b.hash).includes(a.hash)
  )
}

/** Returns true if `a` is a predecessor of `b` */
export const isPredecessorHash = (graph: Graph<any, any>, a: Hash, b: Hash) =>
  getPredecessorHashes(graph, b).includes(a)
