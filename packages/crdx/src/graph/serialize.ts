import { pack, unpack } from 'msgpackr'
import { decryptGraph } from './decrypt.js'
import { redactGraph } from './redactGraph.js'
import { type MaybePartlyDecryptedGraph, type Action, type Graph } from './types.js'
import { type Keyring, type KeysetWithSecrets } from '../keyset/index.js'

export const serialize = <A extends Action, C>(graph: Graph<A, C>) => {
  return pack(redactGraph(graph))
}

export const deserialize = <A extends Action, C>(
  serialized: Uint8Array,
  keys: KeysetWithSecrets | Keyring
): Graph<A, C> => {
  const graph = unpack(serialized) as MaybePartlyDecryptedGraph<A, C>
  return decryptGraph({ encryptedGraph: graph, keys })
}
