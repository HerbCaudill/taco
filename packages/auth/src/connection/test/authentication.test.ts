import { eventPromise, pause } from '@localfirst/shared'
import { cloneDeep } from 'lodash-es'
import { ADMIN } from 'role/index.js'
import * as teams from 'team/index.js'
import {
  TestChannel,
  all,
  anyDisconnected,
  anyUpdated,
  connect,
  connectWithInvitation,
  disconnect,
  expectEveryoneToKnowEveryone,
  joinTestChannel,
  setup,
  tryToConnect,
} from 'util/testing/index.js'
import { describe, expect, it } from 'vitest'
import type { InviteeDeviceContext, MemberContext } from '../types.js'
import { createDevice } from 'device/createDevice.js'

describe('connection', () => {
  describe('authentication', () => {
    describe('with known members', () => {
      it('connects two members', async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
        await connect(alice, bob)

        // 👩🏾 👨🏻‍🦲 Alice and Bob both leave the channel
        await disconnect(alice, bob)
      })

      it("doesn't connect with a member who has been removed", async () => {
        const { alice, bob } = setup('alice', 'bob')

        // 👩🏾 Alice removes Bob
        alice.team.remove(bob.userId)

        // ❌ They can't connect because Bob was removed
        void tryToConnect(alice, bob)
        await anyDisconnected(alice, bob)
      })

      it("doesn't connect with someone who doesn't belong to the team", async () => {
        const { alice, charlie } = setup('alice', 'bob', {
          user: 'charlie',
          member: false,
        })

        charlie.connectionContext = {
          team: teams.createTeam('team charlie', {
            device: charlie.device,
            user: charlie.user,
          }),
          userName: 'charlie',
          user: charlie.user,
          device: charlie.device,
        }

        // ❌ Alice and Charlie can't connect because they're on different teams
        void tryToConnect(alice, charlie)
        await anyDisconnected(alice, charlie)
      })

      it('can reconnect after disconnecting', async () => {
        const { alice, bob } = setup('alice', 'bob')
        // 👩🏾<->👨🏻‍🦲 Alice and Bob connect
        await connect(alice, bob)

        // 👩🏾🔌👨🏻‍🦲 Alice disconnects
        await disconnect(alice, bob)

        // 👩🏾<->👨🏻‍🦲 Alice reconnects
        await connect(alice, bob)

        // ✅ all good
      })

      it("doesn't connect if a peer's signature keys are wrong", async () => {
        const { alice, bob, eve } = setup('alice', 'bob', 'eve')

        // 🦹‍♀️ Eve is going to try to impersonate 👨🏻‍🦲 Bob, but fortunately she doesn't know his secret signature key
        const fakeBob = cloneDeep(bob.device)
        fakeBob.keys.signature.secretKey = eve.user.keys.signature.secretKey

        eve.connectionContext.device = fakeBob
        void connect(alice, eve)

        // Without Bob's secret signature key, Eve won't be able to fake the signature challenge
        const error = await eventPromise(eve.connection[alice.deviceId], 'remoteError')
        expect(error.type).toEqual('IDENTITY_PROOF_INVALID') // ❌
      })

      it("doesn't connect if a peer's encryption keys are wrong", async () => {
        const { alice, bob, eve } = setup('alice', 'bob', 'eve')

        // 🦹‍♀️ Eve is going to try to impersonate 👨🏻‍🦲 Bob, but fortunately she doesn't know his secret encryption key
        const fakeBob = cloneDeep(bob.device)
        fakeBob.keys.encryption.secretKey = eve.user.keys.encryption.secretKey

        eve.connectionContext.device = fakeBob
        void connect(alice, eve)

        // Without Bob's secret encryption key, Eve won't be able to converge on a shared secret
        const error = await eventPromise(eve.connection[alice.deviceId], 'remoteError')
        expect(error.type).toEqual('ENCRYPTION_FAILURE') // ❌
      })
    })

    describe('with invitations', () => {
      it('connects an invitee with a member', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, bob, seed)

        // ✅
        expectEveryoneToKnowEveryone(alice, bob)
      })

      it('alice invites bob then bob invites charlie', async () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const { seed: bobSeed } = alice.team.inviteMember()

        // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, bob, bobSeed)
        expectEveryoneToKnowEveryone(alice, bob)

        // Alice promotes Bob
        alice.team.addMemberRole(bob.userId, ADMIN)
        await anyUpdated(alice, bob)

        // Bob invites Charlie
        const { seed: charlieSeed } = bob.team.inviteMember()

        // Charlie connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, charlie, charlieSeed)

        // ✅
        expectEveryoneToKnowEveryone(alice, bob, charlie)
      })

      it('after being admitted, invitee has team keys', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, bob, seed)

        // Update the team from the connection, which should have the new keys
        const connection = bob.connection[alice.deviceId]
        bob.team = connection.team!

        // 👨🏻‍🦲 Bob has the team keys
        expect(() => bob.team.teamKeys()).not.toThrow()
      })

      it('after an invitee is admitted, the device recorded on the team includes user-agent metadata', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲📧<->👩🏾 Bob connects to Alice and uses his invitation to join
        await connectWithInvitation(alice, bob, seed)

        // Update the team from the connection
        const connection = bob.connection[alice.deviceId]
        bob.team = connection.team!

        // 👨🏻‍🦲 Bob's device was recorded with user-agent metadata
        const { deviceId } = bob.device
        const device = bob.team.device(deviceId)
        expect(device?.deviceInfo).toEqual(bob.device.deviceInfo)
      })

      it("doesn't allow two invitees to connect", async () => {
        const { alice, charlie, dwight } = setup([
          'alice',
          { user: 'charlie', member: false },
          { user: 'dwight', member: false },
        ])

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie
        const { seed: charlieSeed } = alice.team.inviteMember()
        charlie.connectionContext = {
          ...charlie.connectionContext,
          invitationSeed: charlieSeed,
        }

        // 👩🏾 Alice invites 👴 Dwight
        const { seed: dwightSeed } = alice.team.inviteMember()
        dwight.connectionContext = {
          ...dwight.connectionContext,
          invitationSeed: dwightSeed,
        }

        expect(await connect(charlie, dwight)).toEqual(false)
      })

      it('lets a member use an invitation to add a device', async () => {
        const { alice, bob } = setup('alice', 'bob')

        await connect(alice, bob)

        expect(bob.team.members(bob.userId).devices).toHaveLength(1)

        // 👨🏻‍🦲💻📧->📱 on his laptop, Bob creates an invitation and gets it to his phone
        const { seed } = bob.team.inviteDevice()

        // 💻<->📱📧 Bob's phone and laptop connect and the phone joins
        const phoneContext: InviteeDeviceContext = {
          userName: bob.userName,
          device: bob.phone!,
          invitationSeed: seed,
        }
        const join = joinTestChannel(new TestChannel())

        const laptopConnection = join(bob.connectionContext).start()
        const phoneConnection = join(phoneContext).start()

        await all([laptopConnection, phoneConnection], 'connected')

        bob.team = laptopConnection.team!

        // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
        expect(bob.team.members(bob.userId).devices).toHaveLength(2)

        // ✅ 👩🏾👍📱 Alice knows about Bob's phone
        expect(alice.team.members(bob.userId).devices).toHaveLength(2)
      })

      it('lets a member invite a device, remove it, and then add it back', async () => {
        const { alice, bob } = setup('alice', 'bob')
        await connect(alice, bob)

        // Bob invites and admits his phone

        let phone = bob.phone!

        {
          const { seed } = bob.team.inviteDevice()
          const phoneContext: InviteeDeviceContext = {
            userName: bob.userName,
            device: phone,
            invitationSeed: seed,
          }
          const join = joinTestChannel(new TestChannel())
          const laptopConnection = join(bob.connectionContext).start()
          const phoneConnection = join(phoneContext).start()
          await all([laptopConnection, phoneConnection], 'connected')

          bob.team = laptopConnection.team!

          expect(bob.team.members(bob.userId).devices).toHaveLength(2)
          expect(alice.team.members(bob.userId).devices).toHaveLength(2)

          // Bob removes his phone
          laptopConnection.stop()
          bob.team.removeDevice(phone.deviceId)
          await anyUpdated(alice, bob)
          await pause(50)

          expect(bob.team.members(bob.userId).devices).toHaveLength(1)
          expect(alice.team.members(bob.userId).devices).toHaveLength(1)
        }
        {
          // Bob invites his phone again

          // The phone needs a new deviceId, otherwise the connection will immediately
          // fail with DEVICE_REMOVED error after being established. It also gets a new
          // device key as the old one could be compromised.
          phone = createDevice({ userId: bob.userId, deviceName: phone.deviceName })
          bob.phone = phone

          const { seed } = bob.team.inviteDevice()
          const phoneContext: InviteeDeviceContext = {
            userName: bob.userName,
            device: phone,
            invitationSeed: seed,
          }
          const join = joinTestChannel(new TestChannel())
          const laptopConnection = join(bob.connectionContext).start()
          const phoneConnection = join(phoneContext).start()
          await all([laptopConnection, phoneConnection], 'connected')

          bob.team = laptopConnection.team!

          expect(bob.team.members(bob.userId).devices).toHaveLength(2)
          expect(alice.team.members(bob.userId).devices).toHaveLength(2)
        }
      })

      it('lets a different member admit an invited device', async () => {
        const { alice, bob } = setup('alice', 'bob')

        await connect(alice, bob)

        expect(bob.team.members(bob.userId).devices).toHaveLength(1)

        // 👨🏻‍🦲💻📧->📱 on his laptop, Bob creates an invitation and gets it to his phone
        const { seed } = bob.team.inviteDevice()

        // 💻<->📱📧 Bob's phone and Alice's laptop connect and the phone joins
        const phoneContext: InviteeDeviceContext = {
          userName: bob.userName,
          device: bob.phone!,
          invitationSeed: seed,
        }
        const join = joinTestChannel(new TestChannel())
        const aliceConnection = join(alice.connectionContext).start()
        const bobPhoneConnection = join(phoneContext).start()

        await all([aliceConnection, bobPhoneConnection], 'connected')

        alice.team = aliceConnection.team!

        // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
        expect(alice.team.members(bob.userId).devices).toHaveLength(2)

        // ✅ 👩🏾👍📱 Alice knows about Bob's phone
        expect(alice.team.members(bob.userId).devices).toHaveLength(2)
      })

      it('fails to connect when the wrong invitation code is entered', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const seed = 'passw0rd'
        alice.team.inviteMember({ seed })

        // 👨🏻‍🦲📧<->👩🏾 Bob tries to connect, but mistypes his code
        bob.connectionContext = {
          ...bob.connectionContext,
          invitationSeed: 'password',
        }

        void connect(bob, alice)
        const error = await eventPromise(bob.connection[alice.deviceId], 'remoteError')
        expect(error.type).toEqual(`INVITATION_PROOF_INVALID`)
      })

      it('connects an invitee after one failed attempt', async () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾📧👨🏻‍🦲 Alice invites Bob
        const seed = 'passw0rd'
        alice.team.inviteMember({ seed })

        // 👨🏻‍🦲📧<->👩🏾 Bob tries to connect, but mistypes his code
        bob.connectionContext = {
          ...bob.connectionContext,
          invitationSeed: 'password',
        }

        {
          // ❌ The connection fails
          const connected = await connect(bob, alice)
          expect(connected).toEqual(false)
        }

        // 👨🏻‍🦲📧<->👩🏾 Bob tries again with the right code this time
        bob.connectionContext = {
          ...bob.connectionContext,
          invitationSeed: 'passw0rd',
        }

        {
          // ✅ that works
          const connected = await connect(bob, alice)
          expect(connected).toEqual(true)
          bob.team = bob.connection[alice.deviceId].team!
        }

        expectEveryoneToKnowEveryone(alice, bob)
      })

      it('two devices can still connect after removing a third device', async () => {
        const { alice } = setup('alice')

        const laptopContext = alice.connectionContext as MemberContext
        const phoneContext: MemberContext = {
          user: cloneDeep(alice.user),
          device: cloneDeep(alice.phone!),
          team: cloneDeep(alice.team),
        }
        const tablet = createDevice({
          userId: alice.userId,
          deviceName: 'tablet',
          seed: `${alice.userId}-tablet`,
        })
        const tabletContext: MemberContext = {
          user: cloneDeep(alice.user),
          device: tablet,
          team: cloneDeep(alice.team),
        }

        // Alice invites and admits her phone
        {
          const { seed } = alice.team.inviteDevice()
          const phoneInvitationContext: InviteeDeviceContext = {
            userName: alice.userName,
            device: phoneContext.device,
            invitationSeed: seed,
          }
          const join = joinTestChannel(new TestChannel())
          const laptopConnection = join(laptopContext).start()
          const phoneConnection = join(phoneInvitationContext).start()
          await all([laptopConnection, phoneConnection], 'connected')

          phoneContext.team = phoneConnection.team!

          // disconnect
          laptopConnection.stop()
          phoneConnection.stop()
          await all([laptopConnection, phoneConnection], 'disconnected')
        }

        // Alice should have two devices by now
        expect(laptopContext.team.members(alice.userId)?.devices?.length).toEqual(2)
        expect(phoneContext.team.members(alice.userId)?.devices?.length).toEqual(2)

        // Alice invites and admits her tablet
        {
          const { seed } = alice.team.inviteDevice()
          const tabletInvitationContext: InviteeDeviceContext = {
            userName: alice.userName,
            device: tabletContext.device,
            invitationSeed: seed,
          }
          const join = joinTestChannel(new TestChannel())
          const laptopConnection = join(laptopContext).start()
          const tabletConnection = join(tabletInvitationContext).start()
          await all([laptopConnection, tabletConnection], 'connected')

          tabletContext.team = tabletConnection.team!

          // disconnect
          laptopConnection.stop()
          tabletConnection.stop()
          await all([laptopConnection, tabletConnection], 'disconnected')
        }

        // Alice should have three devices by now
        expect(laptopContext.team.members(alice.userId)?.devices?.length).toEqual(3)
        expect(tabletContext.team.members(alice.userId)?.devices?.length).toEqual(3)

        // Alice's user keys are still the first generation
        expect(laptopContext.team.members(alice.userId)?.keys.generation).toBe(0)

        // Alice removes her phone using her laptop, which triggers a user key rotation
        laptopContext.team.removeDevice(phoneContext.device.deviceId)

        // Alice should have two devices left and a new user keys generation on her laptop
        expect(laptopContext.team.members(alice.userId)?.devices?.length).toEqual(2)
        expect(laptopContext.team.members(alice.userId)?.keys.generation).toBe(1)

        // Alice's tablet was offline and does not have the new user keys generation
        expect(tabletContext.team.members(alice.userId)?.devices?.length).toEqual(3)
        expect(tabletContext.team.members(alice.userId)?.keys.generation).toBe(0)

        // Alice connects laptop and tablet
        {
          const join = joinTestChannel(new TestChannel())
          const laptopConnection = join(laptopContext).start()
          const tabletConnection = join(tabletContext).start()

          // if the derivation of a shared key fails during the connection setup, we would see an ENCRYPTION_FAILURE
          laptopConnection.on('localError', console.warn)
          tabletConnection.on('localError', console.warn)

          await all([laptopConnection, tabletConnection], 'connected')

          // Alice's tablet is updated with the latest user keys and correct device count
          expect(tabletContext.team.members(alice.userId)?.devices?.length).toEqual(2)
          expect(tabletContext.team.members(alice.userId)?.keys.generation).toBe(1)

          laptopConnection.stop()
          tabletConnection.stop()
          await all([laptopConnection, tabletConnection], 'disconnected')
        }
      })
    })
  })
})
