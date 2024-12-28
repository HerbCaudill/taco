import type { Base58, Hash, Optional, UnixTimestamp } from '../util/types.js'

/**
 * A hash graph is an acyclic directed graph of links. Each link is **asymmetrically encrypted and
 * authenticated** by the author, and includes **hashes of all known heads** at the time of
 * authoring.
 *
 * This means that the graph is **append-only**: Existing nodes can’t be modified, reordered, or
 * removed without causing the hash and authentication checks to fail.
 *
 * A hash graph is just data and can be stored as JSON. It consists of a hash table of the links
 * themselves, plus the hash of the **root** (the “founding” link added when the graph was created)
 * and the **head** (the most recent link(s) we know about). It also contains information about the
 * dependency structure of the graph, which is used to determine the order in which links should be
 * decrypted.
 *
 * The `EncryptedGraph` can live in public. Each link is asymmetrically encrypted using the author's
 * secret key and the team public key at time of authoring.
 */
export type EncryptedGraph = {
  /** Hash of the root link (the "founding" link added when the graph was created) */
  root: Hash

  /** Hash of the head link (the most recent link we know about) */
  head: Hash[]

  /** Hash table of all the links we know about */
  encryptedLinks: Record<Hash, EncryptedLink>

  /**
   * Dependency structure of the graph, in the form of a dictionary where the keys are the hash of each
   * link, and the values are the hashes of the links that depend on it.
   */
  childMap: LinkMap
}

/**
 * The `Graph` interface includes the decrypted links as well. This is what the application will
 * actually manipulate.
 */
export type Graph<
  /**
   * A is the Action type — typically a union of various `type` labels (e.g. 'ADD_CONTACT') along
   * with the interface of the payload associated with each one.
   */
  A extends Action,
  /**
   * C is the Context interface — by default this is an empty interface, but might contain information
   * about the context in which a link is added (e.g. a device ID, or the version of the
   * application)
   */
  C,
> = {
  /** Decrypted links */
  links: Record<Hash, Link<A, C>>
} & Optional<EncryptedGraph, 'childMap'>

/**
 * When we pass a graph to be decrypted, some of the links might already be encrypted (for
 * instance, when we receive new encrypted links). We want to be able to decrypt the new links
 * without re-decrypting links that we already have.
 */
export type MaybePartlyDecryptedGraph<A extends Action, C> = Record<string, unknown> &
  Optional<Graph<A, C>, 'links'>

/**
 * A `LinkMap` contains information about the graph structure of a `Graph`, without any of the
 * content.
 *
 * It looks like this (where `a`, `b` etc. represent hashes):
 *
 * ```js
 * {
 *   d: ['a'],
 *   e: ['b', 'c'],
 *   f: ['g', 'h', 'i'],
 * }
 *  ```
 *
 * This is used when syncing to determine where two peers have diverged and what additional links
 * they still require to be in sync.
 *
 * The key is the hash of a link. By convention, if the name of the implementing property or
 * variable is `parentMap`, the value is the link's parents (the `prev` value in the `LinkBody`). If
 * the variable name is `childMap`, the value is that link's children.
 *
 * A `LinkMap` can be partial or complete.
 */
export type LinkMap = Record<Hash, Hash[]>

export type EncryptedLink = {
  /**
   * The body of the link, encrypted asymmetrically with authentication (using libsodium's
   * `crypto_box`) using the author's SK and the team's PK.
   */
  encryptedBody: Uint8Array

  /**
   * Public key of the author of the link, at the time of authoring. After decryption, it is up to
   * the application to ensure that this is in fact the public key of the author (`link.body.user`).
   */
  senderPublicKey: Base58

  /**
   * The keys used to decrypt a graph can be rotated at any time. We include the public key of the
   * "recipient" (e.g. the team keys at time of authoring) so that we know which generation of keys
   * to use when decrypting.
   */
  recipientPublicKey: Base58
}

/** A link consists of a body, as well as a hash calculated from the body. */
export type Link<A extends Action, C> = {
  /** Hash of the body */
  hash: Hash

  /** The part of the link that is encrypted */
  body: LinkBody<A, C>

  isInvalid?: boolean
}

/** The root action's payload is defined by the application. */
export type RootAction = {
  type: 'ROOT'
  payload: any
}

/**
 * An `Action` is analogous to a Redux action: it has a string label (e.g. 'ADD_USER' or
 * 'INCREMENT') and a payload that can contain anything. The application will narrow this down
 * by defining a union of all the possible actions.
 */
export type Action =
  | RootAction
  | {
      /** Label identifying the type of action this link represents */
      type: string

      /** Payload of the action */
      payload: any
    }

/** The `LinkBody` adds contextual information to the `Action`. This is the part of the link that is encrypted. */
export type LinkBody<A extends Action, C> = {
  /** User who authored this link */
  userId: string

  /** Unix timestamp on device that created this link */
  timestamp: UnixTimestamp

  /** Head(s) of the graph when this link was added */
  prev: Hash[]
} & A & // plus everything from the action interface
  C // plus everything from the context interface

/** A `Sequence` is a topological sort of a hash graph (or one of its branches). */
export type Sequence<A extends Action, C> = Array<Link<A, C>>

/**
 * A `Resolver` encapsulates the logic for merging concurrent branches. It takes the graph as an
 * argument, and returns two functions:
 * - `sort` is a comparator function that indicates how concurrent branches are to be ordered.
 * - `filter` is a predicate function that indicates which links to include in the resulting
 *   sequence.
 *
 * Suppose you have two concurrent branches `[e, g]` and `[f]`. One resolver might just concatenate
 * the two branches in arbitrary order, resulting in `[e,g,f]` or `[f,e,g]`. Another resolver might
 * return the links in a different order, and/or omit some links; so these concurrent branches might
 * also be resolved as:
 * ```
 *   [e, g, f]
 *   [e, f, g]
 *   [e, g]
 *   [f, g]
 *   [f]
 * ```
 */
export type Resolver<A extends Action, C> = (graph: Graph<A, C>) => {
  sort?: LinkComparator
  filter?: LinkFilter<A, C>
}

/**
 * The comparator for a resolver takes two links and tells us which comes first. Just like an
 * Array.sort() comparator, it is expected to return a negative value if `a` is less than the `b`,
 * zero if `a` and `b` are equal, and a positive value otherwise.
 */
export type LinkComparator = <A extends Action, C>(a: Link<A, C>, b: Link<A, C>) => number

export type LinkFilter<A extends Action, C> = (link: Link<A, C>) => boolean
