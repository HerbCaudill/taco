import { describe, expect, test } from 'vitest'
import { buildGraph, findByPayload } from '../../util/testing/graph.js'
import { getChildren, getRoot } from '../index.js'

describe('getChildren', () => {
  const graph = buildGraph(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o ─┐
         a ─ b ─┤         └─── f ───┤     ├─ n
                ├──── h ──── i ─────┘     │
                └───── j ─── k ── l ──────┘
      `)
  test('root has 1 child', () => expect(getChildren(graph, getRoot(graph))).toHaveLength(1))
  test('b has 3 children', () =>
    expect(getChildren(graph, findByPayload(graph, 'b'))).toHaveLength(3))
  test('d has 2 children', () =>
    expect(getChildren(graph, findByPayload(graph, 'd'))).toHaveLength(2))
  test('e has 1 child', () => expect(getChildren(graph, findByPayload(graph, 'e'))).toHaveLength(1))
  test('n has 0 children', () =>
    expect(getChildren(graph, findByPayload(graph, 'n'))).toHaveLength(0))
})
