import { type KeyScope } from '@localfirst/crdx'
import { type TeamState } from '../types.js'
import { unique } from '../../util/unique.js'

export const visibleScopes = (state: TeamState, { type, name }: KeyScope): KeyScope[] => {
  // Find the keys that the given key can see
  const scopes = state.lockboxes
    .filter(({ recipient }) => recipient.type === type && recipient.name === name)
    .map(({ contents: { type, name } }) => ({ type, name }) as KeyScope)

  // Recursively find all the keys that _those_ keys can see
  const derivedScopes = scopes.flatMap(scope => visibleScopes(state, scope))

  const allScopes = [...scopes, ...derivedScopes]
  return unique(allScopes, s => s.name + s.type)
}
