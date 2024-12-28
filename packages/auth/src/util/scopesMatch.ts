import { type KeyScope } from '@localfirst/crdx'
import { assert } from '@localfirst/shared'
import { getScope } from './getScope.js'

export const scopesMatch = (a: KeyScope, b: KeyScope) => {
  return a.type === b.type && a.name === b.name
}

export const assertScopesMatch = (a: KeyScope, b: KeyScope) => {
  assert(
    scopesMatch(a, b),
    `The scope of the new keys must match those of the old lockbox.
     New scope: ${JSON.stringify(getScope(a))}
     Old scope: ${JSON.stringify(getScope(b))}`
  )
}
