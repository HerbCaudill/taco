import { describe, expect, test } from 'vitest'
import { buildGraph, byPayload, findByPayload, getPayloads } from '../../util/testing/graph.js'
import { type Graph, getConcurrentBubbles, getConcurrentLinks } from '../index.js'

describe('graphs', () => {
  describe('getConcurrentLinks', () => {
    const testConcurrentLinks = (graph: Graph<any, any>, payload: string, expected: string) => {
      const link = findByPayload(graph, payload)
      const result = getConcurrentLinks(graph, link)
      const payloads = getPayloads(result).split('').sort().join('')
      test(`${payload}: ${expected.length > 0 ? expected : '-'}`, () =>
        expect(payloads).toEqual(expected))
    }

    const testBubbles = (graph: Graph<any, any>, expected: string) => {
      const bubbles = getConcurrentBubbles(graph)
        .map(b => getPayloads(b.map(h => graph.links[h]).sort(byPayload)))
        .join(',')

      test(expected.length > 0 ? `bubbles: ${expected}` : 'no bubbles', () =>
        expect(bubbles).toEqual(expected)
      )
    }

    describe('one link', () => {
      const graph = buildGraph('a')
      testConcurrentLinks(graph, 'a', '')
      testBubbles(graph, '')
    })

    describe('no branches', () => {
      const graph = buildGraph(`a ─ b ─ c`)
      testConcurrentLinks(graph, 'a', '')
      testConcurrentLinks(graph, 'b', '')
      testConcurrentLinks(graph, 'c', '')
      testBubbles(graph, '')
    })

    describe('simple open graph', () => {
      const graph = buildGraph(`
          ┌─ b
       a ─┤
          └─ c
      `)
      // b | c
      testConcurrentLinks(graph, 'a', '')
      testConcurrentLinks(graph, 'b', 'c')
      testConcurrentLinks(graph, 'c', 'b')

      testBubbles(graph, 'bc')
    })

    describe('simple closed graph', () => {
      const graph = buildGraph(`
            ┌─ b ─ c ─┐
         a ─┤         ├─ e
            └─── d ───┘
      `)
      // branch pairs:
      // bc | d
      testConcurrentLinks(graph, 'a', '')
      testConcurrentLinks(graph, 'b', 'd')
      testConcurrentLinks(graph, 'c', 'd')
      testConcurrentLinks(graph, 'd', 'bc')
      testConcurrentLinks(graph, 'e', '')

      testBubbles(graph, 'bcd')
    })

    describe('double closed graph', () => {
      const graph = buildGraph(`
            ┌─ b ─ c ─┐     ┌─ f ─ g ─┐
         a ─┤         ├─ e ─┤         ├─ i
            └─── d ───┘     └─── h ───┘
      `)
      // branch pairs:
      // bc | d
      // fg | h
      testConcurrentLinks(graph, 'a', '')
      testConcurrentLinks(graph, 'b', 'd')
      testConcurrentLinks(graph, 'c', 'd')
      testConcurrentLinks(graph, 'd', 'bc')
      testConcurrentLinks(graph, 'e', '')
      testConcurrentLinks(graph, 'f', 'h')
      testConcurrentLinks(graph, 'g', 'h')
      testConcurrentLinks(graph, 'h', 'fg')
      testConcurrentLinks(graph, 'i', '')

      testBubbles(graph, 'bcd,fgh')
    })

    describe('complex graph', () => {
      const graph = buildGraph(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o ─┐
         a ─ b ─┤         └─── f ───┤     ├─ n
                ├──── h ──── i ─────┘     │
                └───── j ─── k ── l ──────┘
      `)
      // branch pairs:
      // hijkl | cd
      // fhijkl | eg
      // eghijkl | f
      // cdefghio | jkl
      // o | jkl
      testConcurrentLinks(graph, 'a', '')
      testConcurrentLinks(graph, 'b', '')
      testConcurrentLinks(graph, 'c', 'hijkl')
      testConcurrentLinks(graph, 'd', 'hijkl')
      testConcurrentLinks(graph, 'e', 'fhijkl')
      testConcurrentLinks(graph, 'g', 'fhijkl')
      testConcurrentLinks(graph, 'f', 'eghijkl')
      testConcurrentLinks(graph, 'j', 'cdefghio')
      testConcurrentLinks(graph, 'k', 'cdefghio')
      testConcurrentLinks(graph, 'l', 'cdefghio')
      testConcurrentLinks(graph, 'o', 'jkl')
      testConcurrentLinks(graph, 'n', '')
      testBubbles(graph, 'cdefghijklo')
    })

    describe('tricky graph', () => {
      const graph = buildGraph(`
                        ┌─── h ────┐
              ┌─ c ─ e ─┤          ├─ k
       a ─ b ─┤         └── i ─ j ─┘
              └── d ────────┘
      `)
      // branch pairs:
      // d | ceh
      // h | dij
      testConcurrentLinks(graph, 'a', '')
      testConcurrentLinks(graph, 'b', '')
      testConcurrentLinks(graph, 'c', 'd')
      testConcurrentLinks(graph, 'e', 'd')
      testConcurrentLinks(graph, 'd', 'ceh')
      testConcurrentLinks(graph, 'h', 'dij')
      testConcurrentLinks(graph, 'i', 'h')
      testConcurrentLinks(graph, 'j', 'h')
      testConcurrentLinks(graph, 'k', '')
      testBubbles(graph, 'cdehij')
    })

    describe('multiple heads', () => {
      const graph = buildGraph(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o
         a ─ b ─┤         └─── f ───┘
                ├─ h ─ i
                └─ j
      `)
      // branch pairs:
      // cd | hij
      // eg | fhij
      // f | eghij
      // hi | cdefgjo
      // j | cdefghio
      testConcurrentLinks(graph, 'a', '')
      testConcurrentLinks(graph, 'b', '')
      testConcurrentLinks(graph, 'c', 'hij')
      testConcurrentLinks(graph, 'd', 'hij')
      testConcurrentLinks(graph, 'e', 'fhij')
      testConcurrentLinks(graph, 'g', 'fhij')
      testConcurrentLinks(graph, 'f', 'eghij')
      testConcurrentLinks(graph, 'h', 'cdefgjo')
      testConcurrentLinks(graph, 'i', 'cdefgjo')
      testConcurrentLinks(graph, 'j', 'cdefghio')
      testBubbles(graph, 'cdefghijo')
    })
  })
})
