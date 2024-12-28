import { getChildrenHashes } from './children.js'
import { type Action, type Link, type LinkComparator, type Graph } from './types.js'
import { type Hash } from '../util/index.js'

/** Flattens a hash graph into a sequence  */
export const topoSort = <A extends Action, C>(
  graph: Graph<A, C>,
  options: TopoSortOptions = {}
): Array<Link<A, C>> => {
  const { comparator = byHash } = options

  // Kahn's algorithm
  // Start with all the links in the graph, in no particular order
  let links = Object.values(graph.links)

  // Create a lookup table to keep track of how many remaining parents each link has
  const remainingParents: Record<Hash, number> = Object.fromEntries(
    links.map(link => [link.hash, link.body.prev.length])
  )

  // This will be the final sorted list
  const sorted: Array<Link<A, C>> = []

  /** Takes the given link to be next in the sorted list, along with any direct children in an uininterrupted sequence */
  const take = (link: Link<A, C>) => {
    // add it to the sorted list
    sorted.push(link)

    // remove it from the list of links to process
    links = links.filter(l => l.hash !== link.hash)

    // any links that had it as a parent now have one less parent
    const children = getChildrenHashes(graph, link.hash)
    for (const child of children) remainingParents[child]--

    // The following change to the algorithm isn't stricly necessary, but it seems cleaner to me.
    // I want any links that are part of an uninterrupted sequence of links (with no branching or
    // merging) to stay together. For example, in this graph, I want the sequences `cd`, `hi`,
    // `jkl`, and `eg` to stay together. But Kahn's algorithm will add `chj`, then `dik`, and so on.
    //
    //                     ┌─ e ─ g ─┐
    //           ┌─ c ─ d ─┤         ├─ o ─┐
    //    a ─ b ─┤         └─── f ───┤     ├─ n
    //           ├──── h ──── i ─────┘     │
    //           └───── j ─── k ── l ──────┘

    // if we have a single child
    if (children.length !== 1) return

    // and we are its only parent
    const childHash = children[0]
    if (remainingParents[childHash] > 0) return

    // then recursively add it to the sorted list as well
    const child = graph.links[childHash]
    take(child)
  }

  while (links.length > 0) {
    const queue = links
      // find links that have no remaining parents
      .filter(link => remainingParents[link.hash] === 0)
      // use the comparator to sort them (by hash, if none provided)
      .sort(comparator)

    // take the first link in the queue and add it to the sorted list
    const nextLink = queue.shift()!
    take(nextLink)
  }

  return sorted
}

type TopoSortOptions = {
  comparator?: LinkComparator
}

// ignore coverage
/** By default, we use the links' hashes to order them in an arbitrary but predictable sequence. */
export const byHash: LinkComparator = (a, b) =>
  a.hash < b.hash
    ? -1 //
    : a.hash > b.hash
      ? 1
      : 0
