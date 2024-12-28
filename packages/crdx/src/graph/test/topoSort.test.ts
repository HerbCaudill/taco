import { describe, expect, test } from 'vitest'
import { buildGraph, byPayload, getPayloads } from '../../util/testing/graph.js'
import { topoSort } from '../index.js'

describe('graphs', () => {
  describe('topoSort', () => {
    test('one link', () => {
      const graph = buildGraph('a')
      const sequence = topoSort(graph)
      const payloads = getPayloads(sequence)
      expect(payloads).toEqual('a')
    })

    test('no branches', () => {
      const graph = buildGraph(`a ─ b ─ c`)
      const sequence = topoSort(graph)
      const payloads = getPayloads(sequence)

      expect(payloads).toEqual('abc')
    })

    describe('simple graph', () => {
      const graph = buildGraph(`
          ┌─ b
       a ─┤
          └─ c
      `)

      test('sorted by payload', () => {
        const sequence = topoSort(graph, { comparator: byPayload })
        const payloads = getPayloads(sequence)
        expect(payloads).toEqual('abc')
      })

      test('sorted by hash', () => {
        const sequence = topoSort(graph)
        const payloads = getPayloads(sequence)
        expect(['abc', 'acb']).toContain(payloads)
      })
    })

    describe('complex graph', () => {
      const graph = buildGraph(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o ─┐
         a ─ b ─┤         └─── f ───┤     ├─ n
                ├──── h ──── i ─────┘     │
                └───── j ─── k ── l ──────┘
      `)
      test('sorted by payload', () => {
        const sequence = topoSort(graph, { comparator: byPayload })
        const payloads = getPayloads(sequence)
        expect(payloads).toEqual('abcdegfhiojkln')
      })

      test('sorted by hash', () => {
        const sequence = topoSort(graph)
        const payloads = getPayloads(sequence)

        // we know how the sequence starts and ends
        expect(payloads.startsWith('ab')).toBe(true)
        expect(payloads.endsWith('n')).toBe(true)

        // beyond that here are lots of possibilities;
        // rather than list them all we'll make sure that certain sequences are kept intact...
        expect(payloads.includes('cd')).toBe(true)
        expect(payloads.includes('hi')).toBe(true)
        expect(payloads.includes('jkl')).toBe(true)
        expect(payloads.includes('eg')).toBe(true)

        // ...and links don't appear before links they depend on
        expect(payloads.indexOf('b')).toBeLessThan(payloads.indexOf('c'))
        expect(payloads.indexOf('a')).toBeLessThan(payloads.indexOf('e'))
        expect(payloads.indexOf('a')).toBeLessThan(payloads.indexOf('n'))
        expect(payloads.indexOf('i')).toBeLessThan(payloads.indexOf('o'))
        expect(payloads.indexOf('f')).toBeLessThan(payloads.indexOf('o'))
      })
    })

    describe('tricky graph', () => {
      const graph = buildGraph(`
                          ┌─── h ────┐
                ┌─ c ─ e ─┤          ├─ k
         a ─ b ─┤         └── i ─ j ─┘
                └── d ────────┘
      `)

      test('sorted by payload', () => {
        const sequence = topoSort(graph, { comparator: byPayload })
        const payloads = getPayloads(sequence)
        expect(payloads).toEqual('abcedijhk')
      })

      test('sorted by hash', () => {
        const sequence = topoSort(graph)
        const payloads = getPayloads(sequence)

        expect(payloads.startsWith('ab')).toBe(true)
        expect(payloads.endsWith('k')).toBe(true)

        expect(payloads.includes('ce')).toBe(true)
        expect(payloads.includes('ij')).toBe(true)

        expect(payloads.indexOf('d')).toBeLessThan(payloads.indexOf('i'))
        expect(payloads.indexOf('e')).toBeLessThan(payloads.indexOf('h'))
        expect(payloads.indexOf('e')).toBeLessThan(payloads.indexOf('i'))
      })
    })

    describe('multiple heads', () => {
      const graph = buildGraph(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o
         a ─ b ─┤         └─── f ───┘
                ├─ h ─ i
                └─ j
      `)
      test('sorted by payload', () => {
        const sequence = topoSort(graph, { comparator: byPayload })
        const payloads = getPayloads(sequence)
        expect(payloads).toEqual('abcdegfohij')
      })
    })
  })
})
