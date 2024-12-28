import { TEST_GRAPH_KEYS } from '../../util/testing/setup.js'
import { describe, expect, it } from 'vitest'
import { append, createGraph, decryptGraph, decryptLink, redactGraph } from '../index.js'
import { createKeyset } from '../../keyset/index.js'
import { createUser } from '../../user/index.js'
import { type Hash } from '../../util/index.js'

const keys = TEST_GRAPH_KEYS

describe('decrypt', () => {
  it('decryptLink', () => {
    const alice = createUser('alice')
    let graph = createGraph<any>({ user: alice, name: 'test graph', keys })
    graph = append({ graph, action: { type: 'FOO' }, user: alice, keys })

    for (const _ in graph.encryptedLinks) {
      const hash = _ as Hash
      const link = graph.encryptedLinks[hash]
      const decryptedLink = decryptLink(link, keys)
      expect(decryptedLink.body).toEqual(graph.links[hash].body)
      expect(decryptedLink.hash).toEqual(hash)
    }
  })

  it('decryptGraph', () => {
    const alice = createUser('alice')
    let graph = createGraph<any>({ user: alice, name: 'test graph', keys })
    graph = append({ graph, action: { type: 'FOO' }, user: alice, keys })

    const encryptedGraph = redactGraph(graph)

    const decryptedGraph = decryptGraph({ encryptedGraph, keys })
    for (const _ in graph.links) {
      const hash = _ as Hash
      const decrypted = decryptedGraph.links[hash]
      const original = graph.links[hash]
      expect(decrypted.body).toEqual(original.body)
      expect(decrypted.hash).toEqual(original.hash)
    }
  })

  it('decryptGraph with keyring', () => {
    const alice = createUser('alice')

    // create a graph with an initial keyset
    const keys1 = createKeyset({ type: 'TEAM', name: 'TEAM' })
    let graph = createGraph<any>({
      user: alice,
      name: 'test graph',
      keys: keys1,
    })

    // suppose the keys are rotated, now we have a new keyset
    const keys2 = createKeyset({ type: 'TEAM', name: 'TEAM' })
    graph = append({ graph, action: { type: 'FOO' }, user: alice, keys: keys2 })

    const encryptedGraph = redactGraph(graph)

    // we pass all the keys we have to decrypt
    const decryptedGraph = decryptGraph({
      encryptedGraph,
      keys: [keys1, keys2],
    })
    for (const _ in graph.links) {
      const hash = _ as Hash
      const decrypted = decryptedGraph.links[hash]
      const original = graph.links[hash]
      expect(decrypted.body).toEqual(original.body)
      expect(decrypted.hash).toEqual(original.hash)
    }
  })
})
