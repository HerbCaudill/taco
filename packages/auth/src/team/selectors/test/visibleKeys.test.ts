import { createKeyset } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import * as select from '../index.js'
import { ADMIN } from '../../../role/index.js'
import { KeyType, getScope } from '../../../util/index.js'
import { setup } from '../../../util/testing/index.js'

const { USER, TEAM, ROLE } = KeyType

describe('visibleKeys', () => {
  it('alice can see admin and team keys', () => {
    const { alice } = setup('alice', { user: 'bob', admin: false })
    const keysAliceSees = select.visibleKeys(alice.team.state, alice.user.keys)
    expect(keysAliceSees.map(getScope)).toEqual([
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])
  })

  it('bob can only see team keys', () => {
    const { bob } = setup('alice', { user: 'bob', admin: false })
    const keysBobKeys = select.visibleKeys(bob.team.state, bob.user.keys)
    expect(keysBobKeys.map(getScope)).toEqual([{ type: TEAM, name: TEAM }])
  })

  it('admin role can see team keys', () => {
    const { alice } = setup('alice')
    alice.team.addRole('MANAGERS')
    const adminKeys = alice.team.adminKeys()
    const keysAdminSees = select.visibleKeys(alice.team.state, adminKeys)
    expect(keysAdminSees.map(getScope)).toEqual([{ type: ROLE, name: 'MANAGERS' }])
  })

  it('admin role can see all other role keys', () => {
    const { alice } = setup('alice')
    alice.team.addRole('MANAGERS')
    const adminKeys = alice.team.adminKeys()
    const keysAdminSees = select.visibleKeys(alice.team.state, adminKeys)
    expect(keysAdminSees.map(getScope)).toEqual([{ type: ROLE, name: 'MANAGERS' }])
  })

  it('after rotating keys, can still see the same scopes', () => {
    const { alice } = setup('alice')
    const getUserKeys = () => select.visibleKeys(alice.team.state, alice.user.keys).map(getScope)

    expect(getUserKeys()).toEqual([
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])

    // Rotating the keys creates new lockboxes, but we don't see duplicate keys
    alice.team.changeKeys(createKeyset({ type: USER, name: alice.userId }))
    expect(getUserKeys()).toEqual([
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])
  })
})
