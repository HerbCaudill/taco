import type { Action, Link, Graph } from './types.js'
import type { Hash } from '../util/index.js'

export const getLink = <A extends Action, C>(graph: Graph<A, C>, hash: Hash): Link<A, C> =>
  graph.links[hash]
