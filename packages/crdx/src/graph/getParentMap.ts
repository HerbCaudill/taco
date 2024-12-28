import { getHashes } from './getHashes.js'
import { getParents } from './getParents.js'
import { type Action, type Graph, type LinkMap } from './types.js'
import { type Hash } from '../util/index.js'

export const EMPTY: LinkMap = {}

/**
 * Collects a graph's most recent links (i.e. the heads and their predecessors, up to a given
 * depth), and maps each link's hash to its parents.
 *
 * ```
 *                   ┌─ e ─ g ─┐
 *         ┌─ c ─ d ─┤         ├─ o ─┐
 *  a ─ b ─┤         └─── f ───┤     ├─ n
 *         ├──── h ──── i ─────┘     │
 *         └───── j ─── k ── l ──────┘
 * ```
 * For example, given this graph and `depth: 2`, this function would return
 * ```
 * {
 *   l: [k],
 *   n: [l, o],
 *   o: [f, g, i],
 * }
 * ```
 * This map is generated to be included in sync messages, and helps peers that have diverged from
 * each other figure out the most recent links they have in common.
 *
 */
export const getParentMap = <A extends Action, C>({
  graph,
  depth,
  start = graph.head,
  end = [],
  prev,
  hashes,
}: {
  /** The graph to collect links from. */
  graph: Graph<A, C>

  /**
   * How many levels back we want to go in the graph. If omitted, we'll get a map covering the whole
   * graph (up to `end`). The actual number of links we'll collect depends on how much branching
   * there is. If not provided, there is no depth limit. */
  depth?: number

  /** The link(s) we want to start with — e.g. the "most recent" links to work back from.  */
  start?: Hash[]

  /**
   * The link(s) that we should stop at — the root by default. For example this could contain the
   * last heads we had in common with a peer, since we wouldn't need to explore further back. */
  end?: Hash[]

  /**
   * If we're not able to find a common ancestor with the recent links we were given, we'll ask to
   * go back further. In that case we provide the last result we got, and pick up from there.    */
  prev?: LinkMap

  hashes?: Hash[]
}): LinkMap => {
  // If we're given a list of hashes, send a linkMap for just those hashes
  if (hashes) {
    return hashes.reduce(
      (result, hash) => ({
        ...result,
        [hash]: getParents(graph, hash),
      }),
      EMPTY
    )
  }

  if (prev)
    // If we're given a previous result, we want to pick up where we left off: The 'tails' of the
    // last result will be the 'heads' used to find the next set of recent links.
    start = getTails(prev)

  // don't go past the depth of levels requested
  if (depth === 0) return EMPTY

  return start.reduce((result, hash) => {
    const parents = getParents(graph, hash)

    const parentsToLookup = parents
      .filter(parent => !(parent in result)) // don't look up parents we've already seen
      .filter(parent => !end.includes(parent)) // don't go past the `end` links

    const parentLinks = getParentMap({
      graph,
      depth: depth ? depth - 1 : undefined,
      start: parentsToLookup,
      end,
    })

    return {
      ...result,
      [hash]: parents,
      ...parentLinks,
    }
  }, EMPTY)
}

export const getTails = (linkMap: LinkMap): Hash[] => {
  // To find the tails, we collect all the parents listed in the given linkMap, and only include the
  // ones that aren't also included as keys, e.g. [g, f, i] in the above example.
  const keys = Object.keys(linkMap) as Hash[]
  const allParents = keys.flatMap(hash => linkMap[hash])
  const tails = allParents.filter(hash => !(hash in linkMap))
  return tails
}

export const getChildMap = <A extends Action, C>(graph: Graph<A, C>): LinkMap => {
  const childMap = {} as LinkMap
  for (const hash of getHashes(graph))
    for (const parent of getParents(graph, hash)) {
      if (!childMap[parent]) childMap[parent] = []
      childMap[parent].push(hash)
    }

  return childMap
}

export const invertLinkMap = (linkMap: LinkMap): LinkMap => {
  const inverted = {} as LinkMap
  const keys = Object.keys(linkMap) as Hash[]
  for (const hash of keys) {
    for (const parent of linkMap[hash]) {
      if (!inverted[parent]) inverted[parent] = []
      inverted[parent].push(hash)
    }
  }

  return inverted
}
