import { createKeyset, redactKeys } from '@localfirst/crdx'
import { ADMIN } from '../../role/index.js'
import { KeyType } from '../../util/index.js'
import '../../util/testing/expect/toLookLikeKeyset.js'
import { setup } from '../../util/testing/index.js'
import { describe, expect, it } from 'vitest'

const { USER, DEVICE } = KeyType

describe('Team', () => {
  describe('keys', () => {
    it('Alice has admin keys and team keys', () => {
      const { alice } = setup('alice')
      const adminKeys = alice.team.roleKeys(ADMIN)
      expect(adminKeys).toLookLikeKeyset()

      const teamKeys = alice.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it('Bob has team keys', () => {
      const { bob } = setup('alice', 'bob')

      // Bob has team keys
      const teamKeys = bob.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it("if Bob isn't admin he doesn't have admin keys", () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      // Bob is not an admin so he doesn't have admin keys
      const bobLooksForAdminKeys = () => bob.team.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow()
    })

    it('if Bob is an admin he has admin keys', () => {
      const { bob } = setup('alice', { user: 'bob', admin: true })

      // Bob is an admin so he does have admin keys
      const adminKeys = bob.team.roleKeys(ADMIN)
      expect(adminKeys).toLookLikeKeyset()
    })

    it('after changing his keys, Bob still has team keys', () => {
      const { bob } = setup('alice', 'bob')

      // Bob has team keys
      const teamKeys = bob.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
      expect(teamKeys.generation).toBe(0)

      // Bob changes his user keys
      const newKeys = createKeyset({ type: USER, name: bob.userId })
      bob.team.changeKeys(newKeys)

      // Bob still has access to team keys
      const teamKeys2 = bob.team.teamKeys()
      expect(teamKeys2).toLookLikeKeyset()
      expect(teamKeys2.generation).toBe(1) // The team keys were rotated, so these are new
    })

    it("Alice can change Bob's keys", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      const newKeys = createKeyset({ type: USER, name: bob.userId })
      const tryToChangeBobsKeys = () => {
        alice.team.changeKeys(newKeys)
      }

      expect(tryToChangeBobsKeys).not.toThrow()
    })

    it('Every time Alice changes her keys, the admin keys are rotated', () => {
      const { alice } = setup('alice')
      const changeKeys = () => {
        const newKeys = { type: KeyType.USER, name: alice.userId }
        alice.team.changeKeys(createKeyset(newKeys))
      }

      expect(alice.team.adminKeys().generation).toBe(0)
      expect(alice.team.state.lockboxes.length).toBe(3) // Team keys for alice, admin keys for alice, alice user keys for alice's laptop

      changeKeys()
      changeKeys()
      changeKeys()
      expect(alice.team.adminKeys().generation).toBe(3)
      expect(alice.team.state.lockboxes.length).toBe(12) // The number of lockboxes shouldn't grow exponentially
    })

    it("Bob can't change Alice's keys", () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      const newKeys = createKeyset({ type: USER, name: 'alice' })
      const tryToChangeAlicesKeys = () => {
        bob.team.changeKeys(newKeys)
      }

      expect(tryToChangeAlicesKeys).toThrow()
    })

    it("Bob can't change Alice's device keys", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      const { deviceId } = alice.device
      const newKeys = createKeyset({ type: DEVICE, name: deviceId })

      const tryToChangeAlicesKeys = () => {
        bob.team.changeKeys(newKeys)
      }

      expect(tryToChangeAlicesKeys).toThrow()
    })

    it("Eve can't change Bob's keys", () => {
      // Eve is tricker than Bob -- rather than try to go through the team object, she's going to
      // try to tamper with the team chain directly.
      const { eve } = setup('alice', 'bob', { user: 'eve', admin: false })
      const newKeys = createKeyset({ type: USER, name: 'bob' })

      // @ts-expect-error - rotateKeys is private
      const lockboxes = eve.team.rotateKeys(newKeys)

      const tryToChangeBobsKeys = () => {
        eve.team.dispatch({
          type: 'CHANGE_MEMBER_KEYS',
          payload: {
            keys: redactKeys(newKeys),
            lockboxes,
          },
        })
      }

      expect(tryToChangeBobsKeys).toThrow()
    })
  })
})
