import { TEST_GRAPH_KEYS as keys, setup } from './setup.js'
import { append } from '../../graph/append.js'
import { createGraph } from '../../graph/createGraph.js'
import { merge } from '../../graph/merge.js'
import { type Action, type Graph, type Link } from '../../graph/types.js'
import { type KeysetWithSecrets } from '../../keyset/index.js'

const { alice } = setup('alice')

export const getPayloads = (sequence: Array<Link<XAction, any>>) =>
  sequence //
    .filter(link => link.body.prev.length) // omit root link
    .filter(link => link.isInvalid !== true) // omit invalid links
    .map(link => link.body.payload as string) // pull out payloads
    .join('') // return as single string

export const findByPayload = (graph: Graph<XAction, any>, payload: XAction['payload']) => {
  const links = Object.values(graph.links)
  return links.find(n => n.body.payload === payload)!
}

// ignore coverage
export const byPayload = (a: Link<XAction, any>, b: Link<XAction, any>) => {
  return a.body.payload < b.body.payload ? -1 : a.body.payload > b.body.payload ? 1 : 0
}

export const buildGraph = (type: string) => {
  const root = createGraph<XAction>({ user: alice, name: 'root', keys })
  switch (trim(type)) {
    // one link
    case 'a': {
      const a = appendLink(root, 'a', keys)
      return a
    }

    // no branches
    case trim(`a ─ b ─ c`): {
      const a = appendLink(root, 'a', keys)
      const b = appendLink(a, 'b', keys)
      const c = appendLink(b, 'c', keys)
      return c
    }

    // simple open
    case trim(`
            ┌─ b
         a ─┤
            └─ c
      `): {
      const a = appendLink(root, 'a', keys)
      const b = appendLink(a, 'b', keys)
      const c = appendLink(a, 'c', keys)
      return merge(b, c)
    }

    // simple closed
    case trim(`
            ┌─ b ─ c ─┐
         a ─┤         ├─ e
            └─── d ───┘

      `): {
      const a = appendLink(root, 'a', keys)
      const b = appendLink(a, 'b', keys)
      const c = appendLink(b, 'c', keys)
      const d = appendLink(a, 'd', keys)
      const e = appendLink(merge(c, d), 'e', keys)
      return e
    }

    // double closed
    case trim(`
            ┌─ b ─ c ─┐     ┌─ f ─ g ─┐
         a ─┤         ├─ e ─┤         ├─ i
            └─── d ───┘     └─── h ───┘

      `): {
      const a = appendLink(root, 'a', keys)
      const b = appendLink(a, 'b', keys)
      const c = appendLink(b, 'c', keys)
      const d = appendLink(a, 'd', keys)
      const e = appendLink(merge(c, d), 'e', keys)
      const f = appendLink(e, 'f', keys)
      const g = appendLink(f, 'g', keys)
      const h = appendLink(e, 'h', keys)
      const i = appendLink(merge(g, h), 'i', keys)
      return i
    }

    // complex
    case trim(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o ─┐
         a ─ b ─┤         └─── f ───┤     ├─ n
                ├──── h ──── i ─────┘     │
                └───── j ─── k ── l ──────┘
      `): {
      const a = appendLink(root, 'a', keys)
      const b = appendLink(a, 'b', keys)
      const c = appendLink(b, 'c', keys)
      const d = appendLink(c, 'd', keys)
      const e = appendLink(d, 'e', keys)
      const g = appendLink(e, 'g', keys)

      const f = appendLink(d, 'f', keys)

      const h = appendLink(b, 'h', keys)
      const i = appendLink(h, 'i', keys)

      const j = appendLink(b, 'j', keys)
      const k = appendLink(j, 'k', keys)
      const l = appendLink(k, 'l', keys)

      const o = appendLink(merge(g, merge(f, i)), 'o', keys)

      const n = appendLink(merge(o, l), 'n', keys)
      return n
    }

    // tricky
    case trim(`
                          ┌─── h ────┐
                ┌─ c ─ e ─┤          ├─ k
         a ─ b ─┤         └── i ─ j ─┘
                └── d ────────┘
      `): {
      const a = appendLink(root, 'a', keys)
      const b = appendLink(a, 'b', keys)
      const c = appendLink(b, 'c', keys)
      const e = appendLink(c, 'e', keys)
      const h = appendLink(e, 'h', keys)

      const d = appendLink(b, 'd', keys)

      const i = appendLink(merge(e, d), 'i', keys)
      const j = appendLink(i, 'j', keys)

      const k = appendLink(merge(h, j), 'k', keys)
      return k
    }

    // multiple heads
    case trim(`
                          ┌─ e ─ g ─┐
                ┌─ c ─ d ─┤         ├─ o
         a ─ b ─┤         └─── f ───┘
                ├─ h ─ i
                └─ j
      `): {
      const a = appendLink(root, 'a', keys)
      const b = appendLink(a, 'b', keys)
      const c = appendLink(b, 'c', keys)
      const d = appendLink(c, 'd', keys)
      const e = appendLink(d, 'e', keys)
      const g = appendLink(e, 'g', keys)
      const f = appendLink(d, 'f', keys)
      const o = appendLink(merge(g, f), 'o', keys)

      const h = appendLink(b, 'h', keys)
      const i = appendLink(h, 'i', keys)

      const j = appendLink(b, 'j', keys)

      return merge(o, merge(i, j))
    }

    default: {
      // ignore coverage
      throw new Error('unknown graph')
    }
  }
}

export type XAction =
  | Action
  | {
      type: 'X'
      payload: string
    }
export type XLink = Link<XAction, Record<string, unknown>>

export const appendLink = (
  graph: Graph<XAction, Record<string, unknown>>,
  payload: string,
  keys: KeysetWithSecrets
) =>
  append({
    graph,
    action: { type: 'X', payload },
    user: alice,
    keys,
  })

export const trim = (s: string) => s.replaceAll(/\s*/g, '')
