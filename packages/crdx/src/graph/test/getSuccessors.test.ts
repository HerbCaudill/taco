import { describe, expect, it, test } from 'vitest'
import { type XLink, buildGraph, findByPayload, getPayloads } from '../../util/testing/graph.js'
import { getRoot, getSuccessors, isSuccessor } from '../index.js'

describe('graphs', () => {
  describe('successors', () => {
    const graph = buildGraph(`
                         ┌─ e ─ g ─┐
               ┌─ c ─ d ─┤         ├─ o ─┐
        a ─ b ─┤         └─── f ───┤     ├─ n
               ├──── h ──── i ─────┘     │
               └───── j ─── k ── l ──────┘
    `)

    describe('getSuccessors', () => {
      const getSuccessorPayloads = (link: XLink): string => {
        const successors = getSuccessors(graph, link)
        return getPayloads(successors).split('').sort().join('')
      }

      test('root', () => {
        const root = getRoot(graph)
        expect(getSuccessorPayloads(root)).toEqual('abcdefghijklno')
      })

      test('d', () => {
        const d = findByPayload(graph, 'd')
        expect(getSuccessorPayloads(d)).toEqual('efgno')
      })

      test('o', () => {
        const o = findByPayload(graph, 'o')
        expect(getSuccessorPayloads(o)).toEqual('n')
      })
    })

    describe('isSuccessor', () => {
      const testCase = (a: string, b: string) => {
        const aLink = findByPayload(graph, a)
        const bLink = findByPayload(graph, b)

        return isSuccessor(graph, aLink, bLink)
      }

      it('f succeeds c', () => expect(testCase('f', 'c')).toBe(true))
      it(`c doesn't succeed f`, () => expect(testCase('c', 'f')).toBe(false))
      it(`c doesn't succeed c`, () => expect(testCase('c', 'c')).toBe(false))
    })
  })
})
