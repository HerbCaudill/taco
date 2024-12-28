import { createId } from '@paralleldrive/cuid2'
import { ROOT } from '../constants.js'
import type { KeysetWithSecrets } from '../keyset/index.js'
import type { UserWithSecrets } from '../user/index.js'
import { append } from './append.js'
import type { Action, Graph } from './types.js'

export const EMPTY_GRAPH = {
  root: undefined,
  head: undefined,
  encryptedLinks: {},
  links: {},
}

type CreateGraphParams<C = Record<string, unknown>> = {
  /** Local user (with secret keys) that is creating the graph.  */
  user: UserWithSecrets

  /** Unique identifier for the graph. If none is provided, a random one will be generated. */
  id?: string

  /** Human facing name of the graph (e.g. document name, team name, etc). This should be unique
   * within the application's namespace. If none is provided, the `id` will be used. */
  name?: string

  /** Object containing information to be added to the ROOT link. */
  rootPayload?: any

  /** Any additional context provided by the application. */
  context?: C

  /** Keyset used to encrypt & decrypt the graph. */
  keys: KeysetWithSecrets
}

export const createGraph = <A extends Action, C = Record<string, unknown>>({
  user,
  id = createId(),
  name = id,
  rootPayload = {},
  context = {} as C,
  keys,
}: CreateGraphParams<C>) => {
  const payload = {
    name,
    id,
    ...rootPayload,
  } as unknown
  const rootAction = {
    type: ROOT,
    prev: [],
    payload,
  } as Action
  const graph = append({
    graph: EMPTY_GRAPH,
    action: rootAction,
    user,
    context,
    keys,
  })
  return graph as Graph<A, C>
}
