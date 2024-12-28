import { buildGraph, findByPayload } from '../../util/testing/graph.js'
import { describe, expect, it } from 'vitest'
import { getLink, getParentMap, type Graph, type Action } from '../index.js'
import { type Hash } from '../../util/index.js'

describe('getParentMap', () => {
  const graph = buildGraph(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o ─┐
         a ─ b ─┤         └─── f ───┤     ├─ n
                ├──── h ──── i ─────┘     │
                └───── j ─── k ── l ──────┘
      `)

  describe('recent hashes', () => {
    it('depth 2', () => {
      const result = getParentMap({ graph, depth: 2 })
      expect(lookupPayloads(graph, result)).toEqual({
        l: 'k',
        n: 'l,o',
        o: 'f,g,i',
      })
    })

    it('depth 3', () => {
      const result = getParentMap({ graph, depth: 3 })
      expect(lookupPayloads(graph, result)).toEqual({
        f: 'd',
        g: 'e',
        i: 'h',
        k: 'j',
        l: 'k',
        n: 'l,o',
        o: 'f,g,i',
      })
    })

    it('depth 10', () => {
      const result = getParentMap({ graph, depth: 10 })

      // this covers the whole graph because the longest path through it is less than 10 links long
      expect(lookupPayloads(graph, result)).toEqual({
        a: '',
        b: 'a',
        c: 'b',
        d: 'c',
        e: 'd',
        f: 'd',
        g: 'e',
        i: 'h',
        h: 'b',
        k: 'j',
        j: 'b',
        l: 'k',
        n: 'l,o',
        o: 'f,g,i',
      })
    })

    it('entire graph', () => {
      const result = getParentMap({ graph }) // depth is undefined
      expect(lookupPayloads(graph, result)).toEqual({
        a: '',
        b: 'a',
        c: 'b',
        d: 'c',
        e: 'd',
        f: 'd',
        g: 'e',
        i: 'h',
        h: 'b',
        k: 'j',
        j: 'b',
        l: 'k',
        n: 'l,o',
        o: 'f,g,i',
      })
    })
  })

  describe('end links', () => {
    const getHashes = (s: string) => s.split('').map(p => findByPayload(graph, p).hash)

    it('b', () => {
      const result = getParentMap({ graph, end: getHashes('b') })
      expect(lookupPayloads(graph, result)).toEqual({
        c: 'b',
        d: 'c',
        e: 'd',
        f: 'd',
        g: 'e',
        i: 'h',
        h: 'b',
        k: 'j',
        j: 'b',
        l: 'k',
        n: 'l,o',
        o: 'f,g,i',
      })
    })

    it('chj', () => {
      const result = getParentMap({ graph, end: getHashes('chj') })
      expect(lookupPayloads(graph, result)).toEqual({
        d: 'c',
        e: 'd',
        f: 'd',
        g: 'e',
        i: 'h',
        k: 'j',
        l: 'k',
        n: 'l,o',
        o: 'f,g,i',
      })
    })

    it('gfik', () => {
      const result = getParentMap({ graph, end: getHashes('gfik') })
      expect(lookupPayloads(graph, result)).toEqual({
        l: 'k',
        n: 'l,o',
        o: 'f,g,i',
      })
    })
  })

  describe('get more recent hashes', () => {
    it('depth 2 + 2', () => {
      const prev = getParentMap({ graph, depth: 2 })

      expect(lookupPayloads(graph, prev)).toEqual({
        l: 'k',
        n: 'l,o',
        o: 'f,g,i',
      })
      const result = getParentMap({ graph, depth: 2, prev })
      expect(lookupPayloads(graph, result)).toEqual({
        d: 'c',
        e: 'd',
        f: 'd',
        g: 'e',
        h: 'b',
        i: 'h',
        j: 'b',
        k: 'j',
      })
    })
  })
})

const lookupPayloads = <A extends Action, C>(
  graph: Graph<A, C>,
  linkMap: Record<Hash, Hash[]>
): Record<Hash, Hash> => {
  const getPayload = (hash: Hash): Hash => {
    const linkBody = getLink(graph, hash).body
    return (linkBody.type === 'ROOT' ? '' : linkBody.payload) as Hash
  }

  const entries = Object.entries(linkMap) as Array<[Hash, Hash[]]>
  return entries.reduce((result, [hash, predecessors]) => {
    const key = getPayload(hash)
    const payload = predecessors
      .map(h => getPayload(h))
      .sort()
      .join(',')
    return {
      ...result,
      ...(key.length > 0 ? { [key]: payload } : {}),
    }
  }, {})
}
