import { createKeyset } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import * as select from '../index.js'
import { ADMIN } from 'role/index.js'
import { KeyType } from 'util/index.js'
import { setup } from 'util/testing/index.js'

const { USER, DEVICE, TEAM, ROLE } = KeyType

describe('visibleScopes', () => {
  it("alice's device can see user, admin and team keys", () => {
    const { alice } = setup('alice')

    const { type, name } = alice.device.keys
    const deviceScopes = select.visibleScopes(alice.team.state, { type, name })
    expect(deviceScopes).toEqual([
      { type: USER, name: alice.userId },
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])
  })

  it('alice can see admin and team keys', () => {
    const { alice } = setup('alice')
    const aliceScopes = select.visibleScopes(alice.team.state, {
      type: USER,
      name: alice.userId,
    })
    expect(aliceScopes).toEqual([
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])
  })

  it('bob can only see team keys', () => {
    const { bob } = setup('alice', { user: 'bob', admin: false })
    const bobScopes = select.visibleScopes(bob.team.state, {
      type: USER,
      name: bob.userId,
    })
    expect(bobScopes).toEqual([{ type: TEAM, name: TEAM }])
  })

  it('admin role can see all other role keys', () => {
    const { alice } = setup('alice')
    alice.team.addRole('MANAGERS')
    const adminScopes = select.visibleScopes(alice.team.state, {
      type: ROLE,
      name: ADMIN,
    })
    expect(adminScopes).toEqual([{ type: ROLE, name: 'MANAGERS' }])
  })

  it('after rotating keys, can still see the same scopes', () => {
    const { alice } = setup('alice')
    const { type, name } = alice.device.keys

    const getDeviceScopes = () => {
      return select.visibleScopes(alice.team.state, { type, name })
    }

    const changeDeviceKeys = () => {
      alice.team.changeKeys(createKeyset({ type, name }))
    }

    expect(getDeviceScopes()).toEqual([
      { type: USER, name: alice.userId },
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])

    // Rotating the keys creates new lockboxes, but we don't see duplicate scopes
    changeDeviceKeys()
    expect(getDeviceScopes().length).toBe(3)

    changeDeviceKeys()
    expect(getDeviceScopes().length).toBe(3)
  })
})
