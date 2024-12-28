import { type SyncMessage, type SyncState } from './types.js'
import {
  type Action,
  getEncryptedLinks,
  getHashes,
  getParentMap,
  getPredecessorHashes,
  type Graph,
  headsAreEqual,
} from '../graph/index.js'
import { type Hash } from '../util/index.js'

/**
 * Generates a new sync message for a peer based on our current graph and our sync state with them.
 *
 * @returns A tuple `[state, message]` containing our updated sync state with this peer, and the
 * message to send them. If the message returned is `undefined`, we are already synced up, they know
 * we're synced up, and we don't have any further information to send.  */
export const generateMessage = <A extends Action, C>(
  /** Our current graph */
  graph: Graph<A, C>,
  /** Our sync state with this peer */
  prevState: SyncState
): [SyncState, SyncMessage | undefined] => {
  const message: SyncMessage = {
    root: graph.root,
    head: graph.head,
  }

  const { their, our, lastCommonHead } = prevState
  const state = { ...prevState }

  const ourHead = graph.head
  const theirHead = their.head

  // CASE 0: Their last message caused an error; let them know
  if (our.reportedError) {
    message.error = our.reportedError
    delete our.reportedError
    return [state, message]
  }

  // CASE 1: We synced up in the last round, and they know we synced up, so we're done
  const syncedLastTime = headsAreEqual(ourHead, lastCommonHead)
  if (syncedLastTime) {
    return [state, undefined]
  }

  // CASE 2: We just synced up, but they might not know that; we'll send one last message just to confirm
  const syncedThisTime = headsAreEqual(ourHead, theirHead)
  if (syncedThisTime) {
    // record the fact that we've converged in our sync state
    state.lastCommonHead = ourHead
    return [state, message]
  }

  // construct a map of everything we think they have
  const theirHashLookup = Object.fromEntries(
    [
      // we know that they have their heads, and any of their predecessors
      ...theirHead,
      ...theirHead.flatMap(h => getPredecessorHashes(graph, h)),

      // their previous heads, and any of their predecessors
      ...lastCommonHead,
      ...lastCommonHead.flatMap(h => getPredecessorHashes(graph, h)),

      // anything in their link map
      ...Object.keys(their.parentMap),

      // anything we've already sent
      ...our.links,
    ].map(h => [h, true])
  )

  let hashesWeThinkTheyNeed = [] as Hash[]

  const weAreAhead =
    theirHead.length > 0 && // if we don't know their head, we can't assume we're ahead
    theirHead.every(h => h in graph.links) // we're ahead if we already have all their heads

  if (weAreAhead) {
    // CASE 3: we are ahead of them, so we don't need anything, AND we know exactly what they need

    // Send them everything we have that they don't have
    hashesWeThinkTheyNeed = getHashes(graph).filter(hash => !(hash in theirHashLookup))
  } else {
    // CASE 4: we're either behind, or have diverged

    // if they've sent us a link map,
    if (their.parentMap) {
      // ask for anything they mention that we don't have
      const linksWeHave = { ...graph.encryptedLinks, ...their.encryptedLinks }
      message.need = Object.keys(theirHashLookup).filter(hash => !(hash in linksWeHave)) as Hash[]

      // and figure out what links they might need
      hashesWeThinkTheyNeed = getHashes(graph).filter(hash => !(hash in theirHashLookup))
    }

    // If our head has changed since last time we sent them a parentMap,
    if (!headsAreEqual(ourHead, our.parentMapAtHead)) {
      // send a new parentMap with everything that's happened since then
      message.parentMap = getParentMap({ graph, end: lastCommonHead })
      // remember that we send this linkmap so we don't send it again
      state.our.parentMapAtHead = ourHead
    }
  }

  // Send them links they need
  const hashesTheyAskedFor = their.need
  const hashesToSend = hashesTheyAskedFor.concat(hashesWeThinkTheyNeed) //

  if (hashesToSend.length > 0) {
    // look up the encrypted links
    message.links = getEncryptedLinks(graph, hashesToSend)
    // add dependency info for links we send
    const additionalDependencies = getParentMap({ graph, hashes: hashesToSend })
    message.parentMap = { ...message.parentMap, ...additionalDependencies }
  }

  // update our state

  // record what we've sent them
  state.our.links = our.links.concat(hashesToSend)

  // We've sent them everything they've asked for, so reset their need
  state.their.need = []

  return [state, message]
}
