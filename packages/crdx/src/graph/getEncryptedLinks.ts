import type { Hash } from '../util/index.js'
import type { Graph } from './types.js'

export const getEncryptedLinks = (graph: Graph<any, any>, hashes: Hash[]) =>
  Object.fromEntries(hashes.map(hash => [hash, getEncryptedLink(graph, hash)]))

export const getEncryptedLink = (graph: Graph<any, any>, hash: Hash) => graph.encryptedLinks[hash]
