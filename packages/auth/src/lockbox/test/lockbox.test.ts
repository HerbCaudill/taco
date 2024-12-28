import { createKeyset } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { create, open, rotate } from '../index.js'
import { KeyType } from '../../util/types.js'
import { setup } from '../../util/testing/setup.js'
import { ADMIN } from '../../role/constants.js'

const { bob, eve } = setup('alice', 'bob', { user: 'eve', member: false })
const MANAGERS = 'managers'

describe('lockbox', () => {
  it('can be opened by the intended recipient', () => {
    const adminKeys = createKeyset({ type: KeyType.ROLE, name: ADMIN })

    // Alice creates a lockbox for Bob containing the admin keys
    const lockbox = create(adminKeys, bob.user.keys)

    // Bob opens the lockbox and gets the admin keys
    const keys = open(lockbox, bob.user.keys)
    expect(keys).toEqual(adminKeys)
  })

  it("can't be opened by anyone else", () => {
    const adminKeys = createKeyset({ type: KeyType.ROLE, name: ADMIN })

    // Alice creates a lockbox for Bob containing the admin keys
    const lockbox = create(adminKeys, bob.user.keys)

    // Eve tries to open the lockbox but can't
    const eveTriesToOpen = () => open(lockbox, eve.user.keys)
    expect(eveTriesToOpen).toThrow()
  })

  it('can only be rotated with a keyset of the same type', () => {
    const adminKeys = createKeyset({ type: KeyType.ROLE, name: ADMIN })

    // Alice creates a lockbox for Bob containing the admin keys
    const lockbox = create(adminKeys, bob.user.keys)

    const newKeys = createKeyset({ type: KeyType.ROLE, name: MANAGERS })
    const tryToRotate = () => rotate({ oldLockbox: lockbox, newContents: newKeys })
    expect(tryToRotate).toThrow()
  })
})
