import type { Graph } from './types.js'
import type { Hash } from '../util/index.js'

export const getHashes = (graph: Graph<any, any>) => Object.keys(graph.links) as Hash[]
