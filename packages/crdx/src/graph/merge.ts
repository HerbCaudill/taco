import { uniq } from 'lodash-es'
import { type Action, type EncryptedLink, type Link, type Graph } from './types.js'
import { type Hash } from '../util/index.js'

/**
 * Returns a new graph that contains all the information in the two graphs provided.
 *
 * Note that this no longer checks the graph for validity — that is the responsibility of the
 * caller, as it's up to the caller to determine what to do about it.
 */
export const merge = <A extends Action, C>(
  /**
   * The first graph to merge. Note that this graph's values win in case there are different links
   * with the same keys, so this should be the more trusted of the two, e.g. the local one rather
   * than the remote.
   * */
  ours: Graph<A, C>,

  /** The second graph. This should be the less trusted of the two, e.g. the remote one.  */
  theirs: Graph<A, C>
): Graph<A, C> => {
  if (ours.root !== theirs.root) throw new Error('Cannot merge two graphs with different roots')

  // The new graph will contain all the links from either graph
  const mergedLinks: Record<Hash, Link<A, C>> = {
    ...theirs.links,
    ...ours.links,
  }
  const mergedEncryptedLinks: Record<Hash, EncryptedLink> = {
    ...theirs.encryptedLinks,
    ...ours.encryptedLinks,
  }

  const mergedHeads: Hash[] = uniq([...ours.head, ...theirs.head])

  // If one of the heads is a parent of an existing link, it is no longer a head
  const newHeads = mergedHeads.filter(isNotParentOfAnyOf(mergedLinks))

  const mergedGraph: Graph<A, C> = {
    root: ours.root,
    head: newHeads,
    encryptedLinks: mergedEncryptedLinks,
    links: mergedLinks,
  }

  mergedGraph.head = mergedGraph.head.sort()

  return mergedGraph
}

/** Returns true if the given hash is not a parent of any of those links */
const isNotParentOfAnyOf =
  <A extends Action, C>(links: Record<Hash, Link<A, C>>) =>
  (h: Hash) =>
    !Object.values(links).some(isParent(h))

/** Returns true if h is the parent of the given link */
const isParent =
  <A extends Action, C>(h: Hash) =>
  (l: Link<A, C>) =>
    l.body.prev.includes(h)
