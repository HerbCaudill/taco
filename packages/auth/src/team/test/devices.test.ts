import { createDevice, redactDevice } from '../../index.js'
import { setup as setupUsers } from '../../util/testing/index.js'
import { describe, expect, it } from 'vitest'

describe('Team', () => {
  const setup = () => {
    const { alice, bob } = setupUsers(['alice', { user: 'bob', admin: false }])
    return { alice, bob }
  }

  describe('devices', () => {
    it('Alice has a device', () => {
      const { alice } = setup()
      expect(alice.team.members(alice.userId).devices).toHaveLength(1)
    })

    it('Bob has a device', () => {
      const { alice, bob } = setup()
      expect(alice.team.members(bob.userId).devices).toHaveLength(1)
    })

    it(`Bob can remove Bob's device`, () => {
      const { bob } = setup()
      bob.team.removeDevice(bob.device.deviceId)
      expect(bob.team.members(bob.userId)?.devices ?? []).toHaveLength(0)
    })

    it("Alice can remove Bob's device", () => {
      const { alice, bob } = setup()
      alice.team.removeDevice(bob.device.deviceId)
      expect(alice.team.members(bob.userId).devices).toHaveLength(0)
    })

    it("Bob cannot remove Alice's device", () => {
      const { alice, bob } = setup()
      const aliceDevice = bob.team.members(alice.userId).devices![0].deviceId
      const tryToRemoveDevice = () => {
        bob.team.removeDevice(aliceDevice)
      }

      expect(tryToRemoveDevice).toThrowError()
    })

    it("doesn't remove other devices with the same name", () => {
      const { alice } = setup()

      // Alice already has a device called 'laptop'
      const firstLaptop = alice.device
      expect(firstLaptop.deviceName).toBe('laptop')
      expect(alice.team.members(alice.userId).devices).toHaveLength(1)

      // Alice adds a second device also called 'laptop'
      const secondLaptop = createDevice({ userId: alice.userId, deviceName: 'laptop' })
      alice.team.addForTesting(alice.user, [], redactDevice(secondLaptop))
      expect(alice.team.members(alice.userId).devices).toHaveLength(2)

      // Alice removes the first laptop
      alice.team.removeDevice(alice.device.deviceId)

      // The second laptop is still there
      expect(alice.team.members(alice.userId).devices).toHaveLength(1)
    })

    it('deviceWasRemoved works as expected', () => {
      const { alice, bob } = setup()
      alice.team.removeDevice(bob.device.deviceId)
      expect(alice.team.deviceWasRemoved(alice.device.deviceId)).toBe(false) // Device still exists
      expect(alice.team.deviceWasRemoved(bob.device.deviceId)).toBe(true) // Device was removed
      expect(alice.team.deviceWasRemoved(bob.phone!.deviceId)).toBe(false) // Device never existed
    })

    it('throws when trying to remove a removed device', () => {
      const { alice, bob } = setup()
      const bobDevice = alice.team.members(bob.userId).devices![0].deviceId
      alice.team.removeDevice(bobDevice)

      const removeAgain = () => alice.team.removeDevice(bobDevice)
      expect(removeAgain).toThrow()
    })

    it('throws when trying to remove a nonexistent device', () => {
      const { alice, bob } = setup()
      const _bobDevice = alice.team.members(bob.userId).devices![0].deviceId

      const remove = () => alice.team.removeDevice('pizza')
      expect(remove).toThrow()
    })

    it('throws when trying to access a removed device', () => {
      const { alice, bob } = setup()
      const bobDevice = alice.team.members(bob.userId).devices![0].deviceId
      alice.team.removeDevice(bobDevice)

      const getDevice = () => alice.team.device(bobDevice)
      expect(getDevice).toThrow()
    })

    it("doesn't throw when deliberately trying to access a removed device", () => {
      const { alice, bob } = setup()
      const bobDevice = alice.team.members(bob.userId).devices![0].deviceId
      alice.team.removeDevice(bobDevice)

      const getDevice = () => alice.team.device(bobDevice, { includeRemoved: true })
      expect(getDevice).not.toThrow()
    })

    it('can look up a device by deviceId', () => {
      const { alice } = setup()
      const { deviceId } = alice.device
      const aliceDevice = alice.team.device(deviceId)
      expect(aliceDevice.deviceId).toBe(deviceId)
    })

    it('can find a userId by deviceId', () => {
      const { alice } = setup()
      const { deviceId } = alice.device

      const result = alice.team.memberByDeviceId(deviceId)
      expect(result.userId).toBe(alice.userId)
    })

    it('throws when trying to access a nonexistent device', () => {
      const { alice } = setup()
      const getDevice = () => alice.team.device('alicez wrist communicator')
      expect(getDevice).toThrow()
    })

    it('rotates keys after removing a device', () => {
      const { alice, bob } = setup()

      // Keys have never been rotated
      expect(alice.team.teamKeys().generation).toBe(0)
      expect(bob.team.members(bob.userId)?.keys.generation).toBe(0)
      expect(bob.user.keys.generation).toBe(0)
      const { secretKey } = alice.team.teamKeys()

      // Add bob's phone
      const phone = redactDevice(bob.phone!)
      bob.team.addForTesting(bob.user, [], phone)

      // Remove bob's phone
      bob.team.removeDevice(phone.deviceId)

      // User keys have now been rotated once
      expect(bob.team.members(bob.userId)?.keys.generation).toBe(1)
      expect(bob.user.keys.generation).toBe(1)

      // Team keys have now been rotated once
      expect(bob.team.teamKeys().generation).toBe(1)
      expect(bob.team.teamKeys().secretKey).not.toBe(secretKey)
    })
  })
})
