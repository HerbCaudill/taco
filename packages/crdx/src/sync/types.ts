import { type EncryptedLink, type LinkMap } from '../graph/index.js'
import { type Hash } from '../util/index.js'
import { type ValidationError } from '../validator/index.js'

export type SyncState = {
  their: {
    /** Their head as of the last time they sent a sync message. */
    head: Hash[]

    /** Links they've sent that we haven't added yet (e.g. because we're missing dependencies). */
    encryptedLinks: Record<Hash, EncryptedLink>

    /** The map of hashes they've sent to those links' parents. */
    parentMap: LinkMap

    /** Hashes of links they asked for in the last message. */
    need: Hash[]
  }

  our: {
    /** Our head as of the last message */
    head: Hash[]

    /** The last error we sent them */
    reportedError?: ValidationError

    /** Our head when we sent the last linkMap, so we don't keep sending it */
    parentMapAtHead?: Hash[]

    /** List of links we've sent them, so we don't send them multiple times */
    links: Hash[]
  }

  /** The head we had in common with this peer the last time we synced. If empty, we haven't synced before. */
  lastCommonHead: Hash[]

  /** We increment this each time a sync fails because we would have ended up with an invalid graph */
  failedSyncCount: number
}

export type SyncMessage = {
  /** Our root. We just send this as a sanity check - if our roots don't match we can't sync. */
  root: Hash

  /** Our head at the time of sending. */
  head: Hash[]

  /** Any links we know we need. */
  links?: Record<Hash, EncryptedLink>

  /** Our most recent hashes and their dependencies. */
  parentMap?: LinkMap

  /** Any hashes we know we need. */
  need?: Hash[]

  /** Any errors caused by their last sync message. */
  error?: ValidationError
}
