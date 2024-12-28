import { createKeyring, createKeyset, type UnixTimestamp } from '@localfirst/crdx'
import { signatures } from '@localfirst/crypto'
import { redactDevice, Team, type FirstUseDevice } from '../../index.js'
import { generateProof } from '../../invitation/index.js'
import * as teams from '../index.js'
import { KeyType } from '../../util/index.js'
import { setup } from '../../util/testing/index.js'
import { describe, expect, it } from 'vitest'

const { USER } = KeyType

describe('Team', () => {
  describe('invitations', () => {
    describe('members', () => {
      it('accepts valid proof of invitation', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in, associating
        // him with the public keys he's provided
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ 👨🏻‍🦲 Bob is now on the team. Congratulations, Bob!
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it('lets you use a secret invitation seed of your choosing', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a secret key of her choosing
        const seed = 'passw0rd'
        alice.team.inviteMember({ seed })

        const proofOfInvitation = generateProof(seed)

        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ Still works
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it('normalizes the a secret invitation seed ', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob
        const seed = 'abc def ghi'
        alice.team.inviteMember({ seed })

        // 👨🏻‍🦲 Bob accepts the invitation using a url-friendlier version of the key
        const proofOfInvitation = generateProof('abc+def+ghi')
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ Bob is on the team
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it('allows non-admins to accept an invitation', () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', member: false }
        )

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed } = alice.team.inviteMember()

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // Later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        let persistedTeam = alice.team.save()
        const bobsTeam = teams.load(persistedTeam, bob.localContext, alice.team.teamKeys())

        // Just to confirm: 👨🏻‍🦲 Bob isn't an admin
        expect(bobsTeam.memberIsAdmin(bob.userId)).toBe(false)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        bobsTeam.admitMember(proofOfInvitation, charlie.user.keys, charlie.user.userName)

        // 👍👳🏽‍♂️ Charlie is now on the team
        expect(bobsTeam.has(charlie.userId)).toBe(true)

        // ✅ 👩🏾 Alice can now see that 👳🏽‍♂️ Charlie is on the team. Congratulations, Charlie!
        persistedTeam = bobsTeam.save()
        alice.team = teams.load(persistedTeam, alice.localContext, alice.team.teamKeys())
        expect(alice.team.has(charlie.userId)).toBe(true)
      })

      it("will use an invitation that hasn't expired yet", () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob with a future expiration date
        const expiration = new Date(Date.UTC(2999, 12, 25)).valueOf() as UnixTimestamp // NOTE 👩‍🚀 this test will fail if run in the distant future
        const { seed } = alice.team.inviteMember({ expiration })
        const proofOfInvitation = generateProof(seed)
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ 👨🏻‍🦲 Bob's invitation has not expired so he is on the team
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it("won't use an expired invitation", () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // A long time ago 👩🏾 Alice invited 👨🏻‍🦲 Bob
        const expiration = new Date(Date.UTC(2020, 12, 25)).valueOf() as UnixTimestamp
        const { seed } = alice.team.inviteMember({ expiration })
        const proofOfInvitation = generateProof(seed)

        const tryToAdmitBob = () => {
          alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)
        }

        // 👎 👨🏻‍🦲 Bob's invitation has expired so he can't get in
        expect(tryToAdmitBob).toThrowError(/expired/)

        // ❌ 👨🏻‍🦲 Bob is not on the team
        expect(alice.team.has(bob.userId)).toBe(false)
      })

      it('can use an invitation multiple times', () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        const { seed } = alice.team.inviteMember({ maxUses: 2 })

        // 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie both generate the same proof of invitation from the seed
        const proofOfInvitation = generateProof(seed)

        // 👩🏾 Alice admits them both

        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)
        alice.team.admitMember(proofOfInvitation, charlie.user.keys, charlie.user.userName)

        // ✅ 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie are both on the team
        expect(alice.team.has(bob.userId)).toBe(true)
        expect(alice.team.has(charlie.userId)).toBe(true)
      })

      it('can use an invitation infinite uses when maxUses is zero', () => {
        const { alice } = setup('alice')

        // 👩🏾 Alice makes an invitation that anyone can use
        const { seed } = alice.team.inviteMember({ maxUses: 0 }) // No limit
        const proofOfInvitation = generateProof(seed)

        // A bunch of people use the same invitation and 👩🏾 Alice admits them all
        const invitees = `
            amanda, bob, charlie, dwight, edwin, frida, gertrude, herbert,
            ignaszi, joão, krishna, lashawn, mary, ngunda, oprah, phil, quân,
            rainbow, steve, thad, uriah, vanessa, wade, xerxes, yazmin, zelda`
          .replaceAll(/\s/g, '')
          .split(',')
        for (const userId of invitees) {
          const userKeys = createKeyset({ type: USER, name: userId })
          alice.team.admitMember(proofOfInvitation, userKeys, userId)
        }

        // ✅ they're all on the team
        for (const userId of invitees) {
          expect(alice.team.has(userId)).toBe(true)
        }
      })

      it("won't use an invitation more than the maximum uses defined", () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        const { seed } = alice.team.inviteMember({ maxUses: 1 })

        // 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie both generate the same proof of invitation from the seed
        const proofOfInvitation = generateProof(seed)

        const tryToAdmitBob = () => {
          alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)
        }

        const tryToAdmitCharlie = () => {
          alice.team.admitMember(proofOfInvitation, charlie.user.keys, charlie.user.userName)
        }

        // 👍 👨🏻‍🦲 Bob uses the invitation first and he gets in
        expect(tryToAdmitBob).not.toThrow()

        // 👎 👳🏽‍♂️ Charlie also tries to use the invitation, but it can only be used once
        expect(tryToAdmitCharlie).toThrow(/used/)

        // ✅ 👨🏻‍🦲 Bob is on the team
        expect(alice.team.has(bob.userId)).toBe(true)

        // ❌ 👳🏽‍♂️ Charlie is not on the team
        expect(alice.team.has(charlie.userId)).toBe(false)
      })

      it("won't use a revoked invitation", () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', member: false }
        )

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed, id } = alice.team.inviteMember()

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 👩🏾 Alice changes her mind and revokes the invitation
        alice.team.revokeInvitation(id)

        // Later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        const persistedTeam = alice.team.save()
        bob.team = teams.load(persistedTeam, bob.localContext, alice.team.teamKeys())

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        const tryToAdmitCharlie = () => {
          bob.team.admitMember(proofOfInvitation, charlie.user.keys, charlie.user.userName)
        }

        // 👎 But the invitation is rejected because it was revoked
        expect(tryToAdmitCharlie).toThrowError(/revoked/)

        // ❌ 👳🏽‍♂️ Charlie is not on the team
        expect(bob.team.has(charlie.userId)).toBe(false)
      })

      it("won't accept proof of invitation with an invalid signature", () => {
        const { alice, eve } = setup('alice', 'eve')
        const { team } = alice

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed: _seed } = alice.team.inviteMember()

        // 🦹‍♀️ Eve is a member of the group and she wants to hijack Bob's invitation for her
        // nefarious purposes. so she tries to create a proof of invitation.

        // She can get the id from the graph
        const invitation = Object.values(team.state.invitations)[0]
        const { id } = invitation

        const payload = { id }
        const signature = signatures.sign(payload, eve.user.keys.signature.secretKey)
        const badProof = { id, signature }

        // 🦹‍♀️ Eve shows 👩🏾 Alice her proof of invitation
        const submitBadProof = () => team.admitMember(badProof, eve.user.keys, 'bob')

        // 🦹‍♀️ GRRR I would've got away with it too, if it weren't for you meddling cryptographic algorithms!
        expect(submitBadProof).toThrow('Signature provided is not valid')
      })

      it('an invited member needs access to all generations of user and team keys', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        const changeKeys = () => {
          const newKeys = { type: KeyType.USER, name: alice.userId }
          alice.team.changeKeys(createKeyset(newKeys))
        }

        // Alice rotates her keys two times
        changeKeys()
        changeKeys()

        // key rotation results in two new keys generations for team keys, admin keys and alice user keys
        expect(alice.team.teamKeys().generation).toBe(2)
        expect(alice.team.adminKeys().generation).toBe(2)
        expect(alice.team.members(alice.userId).keys.generation).toBe(2)
        expect(alice.user.keys.generation).toBe(2)
        expect(Object.values(alice.team.teamKeyring())).toHaveLength(3)
        expect(Object.values(alice.team.userKeyring())).toHaveLength(3)

        // 3 times 3 generations of team keys, admin keys, alice user keys
        expect(alice.team.state.lockboxes.length).toBe(9)

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ Alice added 3 lockboxes to send 3 generations of team keys to Bob
        expect(alice.team.state.lockboxes.length).toBe(12)

        // 👩🏾 Alice sends 👨🏻‍🦲 Bob the team's graph and keyring
        const serializedGraph = alice.team.save()
        const teamKeyring = alice.team.teamKeyring()

        const bobTeam = new Team({
          source: serializedGraph,
          context: bob.localContext,
          teamKeyring,
        })
        bobTeam.join(teamKeyring, createKeyring(bob.user.keys))

        // ✅ 👨🏻‍🦲 Bob is now on the team
        expect(alice.team.has(bob.userId)).toBe(true)

        // ✅ Now Alice and Bob have each two members on the team
        expect(alice.team.members()).toHaveLength(2)
        expect(bobTeam.members()).toHaveLength(2)
        expect(bobTeam.has(alice.userId)).toBe(true)

        // ✅ Bob added 1 more lockbox for his user keys that can be unlocked by his device keys
        expect(bobTeam.state.lockboxes.length).toBe(13)

        // ✅ Bob has all 3 generations of team keys and 1 generation of his user keys
        expect(Object.values(bobTeam.teamKeyring())).toHaveLength(3)
        expect(Object.values(bobTeam.userKeyring())).toHaveLength(1)

        const serializedBobTeam = bobTeam.save()

        // In case some keys went missing while serializing and deserializing the team graph
        // on Bob's device, some required keys wouldn't be available to decrypt the graph,
        // resulting in the error "Can't decrypt link: don't have the correct keyset"
        expect(
          () =>
            new Team({
              source: serializedBobTeam,
              context: bob.localContext,
              teamKeyring: bobTeam.teamKeyring(),
            })
        ).not.toThrow()
      })

      it("won't accept proof of invitation with a username that is not unique", () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, but uses Alice's username
        const tryToAdmitBob = () => {
          alice.team.admitMember(proofOfInvitation, bob.user.keys, alice.user.userName)
        }

        // 👎 But the invitation is rejected because the username is not unique
        expect(tryToAdmitBob).toThrowError('Username is not unique within the team.')

        // ❌ 👨🏻‍🦲 Bob is not on the team
        expect(alice.team.has(bob.userId)).toBe(false)
      })

      it("won't accept proof of invitation with a userId that is not unique", () => {
        const { alice, eve } = setup('alice', { user: 'eve', member: false })

        // 👩🏾 Alice invites 🦹‍♀️ Eve by sending her a random secret key
        const { seed } = alice.team.inviteMember()

        // 🦹‍♀️ Eve accepts the invitation
        const proofOfInvitation = generateProof(seed)

        // 🦹‍♀️ Eve prepares keys using Alice's userId
        const keysWithAliceUserId = {
          ...eve.user.keys,
          name: alice.userId,
        }

        // 🦹‍♀️ Eve shows 👩🏾 Alice her proof of invitation, but uses Alice's userId
        const tryToAdmitEve = () => {
          alice.team.admitMember(proofOfInvitation, keysWithAliceUserId, eve.user.userName)
        }

        // 👎 But the invitation is rejected because the userId is not unique
        expect(tryToAdmitEve).toThrowError('userId is not unique within the team.')

        // ❌ 🦹‍♀️ Eve is not on the team
        expect(alice.team.has(eve.userId)).toBe(false)
        expect(
          alice.team.state.members.filter(({ userId }) => userId === alice.userId)
        ).toHaveLength(1)
        expect(alice.team.members(alice.userId).userName === alice.userName).toBe(true)
      })

      describe('devices', () => {
        it('creates and accepts an invitation for a device', () => {
          const { alice: aliceLaptop } = setup('alice')
          const alicePhone = aliceLaptop.phone!

          // 👩🏾 Alice only has 💻 one device on the signature chain
          expect(aliceLaptop.team.members(aliceLaptop.userId).devices).toHaveLength(1)

          // 💻 on her laptop, Alice generates an invitation for her phone
          const { seed } = aliceLaptop.team.inviteDevice()

          // 📱 Alice gets the seed to her phone, perhaps by typing it in or by scanning a QR code.

          // Alice's phone uses the seed to generate her starter keys and her proof of invitation
          const proofOfInvitation = generateProof(seed)

          // 📱 Alice's phone connects with 💻 her laptop and presents the proof
          aliceLaptop.team.admitDevice(proofOfInvitation, redactDevice(alicePhone))

          // 👍 The proof was good, so the laptop sends the phone the team's graph and keyring
          const serializedGraph = aliceLaptop.team.save()
          const teamKeyring = aliceLaptop.team.teamKeyring()

          // 📱 Alice's phone needs to get her user keys.

          // To do that, she uses the invitation seed to generate starter keys, which she can use to
          // unlock a lockbox stored on the graph containing her user keys.
          const { user: aliceUser } = teams.getDeviceUserFromGraph({
            serializedGraph,
            teamKeyring,
            invitationSeed: seed,
          })

          const phoneTeam = teams.load(
            serializedGraph,
            { user: aliceUser, device: alicePhone },
            teamKeyring
          )

          // ✅ Now Alice has 💻📱 two devices on the signature chain
          expect(phoneTeam.members(aliceLaptop.userId).devices).toHaveLength(2)
          expect(aliceLaptop.team.members(aliceLaptop.userId).devices).toHaveLength(2)
        })

        it("lets someone else admit Alice's device", () => {
          const { alice, bob } = setup('alice', 'bob')

          // 👩🏾 Alice only has 💻 one device on the signature chain
          expect(alice.team.members(alice.userId).devices).toHaveLength(1)

          // 💻 on her laptop, Alice generates an invitation for her phone
          const { seed } = alice.team.inviteDevice()

          // 📱 Alice gets the seed to her phone, perhaps by typing it in or by scanning a QR code.

          // Alice's phone uses the seed to generate her starter keys and her proof of invitation
          const proofOfInvitation = generateProof(seed)

          // 👨🏻‍🦲 Bob syncs up with Alice
          const savedTeam = alice.team.save()
          bob.team = teams.load(savedTeam, bob.localContext, alice.team.teamKeys())

          // 📱 Alice's phone connects with 👨🏻‍🦲 Bob and she presents the proof
          bob.team.admitDevice(proofOfInvitation, redactDevice(alice.phone!))
        })

        it("won't accept proof of invitation with an invalid signature", () => {
          const { alice, eve } = setup('alice', 'eve')

          // 👩🏾 Alice only has 💻 one device on the signature chain
          expect(alice.team.members(alice.userId).devices).toHaveLength(1)

          // 💻 on her laptop, Alice generates an invitation for her phone
          const _seed = alice.team.inviteDevice().seed

          // 🦹‍♀️ Eve is a member of the group and she wants to hijack Alice's device invitation
          // for her nefarious purposes. so she tries to create a proof of invitation.

          // She can get the id from the graph
          const invitation = Object.values(alice.team.state.invitations)[0]
          const { id } = invitation

          const payload = { id }
          const signature = signatures.sign(payload, eve.user.keys.signature.secretKey)
          const badProof = { id, signature }

          // 🦹‍♀️ Eve shows 👩🏾 Alice her proof of invitation
          const submitBadProof = () =>
            alice.team.admitDevice(badProof, redactDevice(eve.device) as FirstUseDevice)

          // 🦹‍♀️ GRRR I would've got away with it too, if it weren't for you meddling cryptographic algorithms!
          expect(submitBadProof).toThrow('Signature provided is not valid')
        })

        it('an invited device needs access to all generations of user and team keys', () => {
          const { alice: aliceLaptop } = setup('alice')
          const alicePhone = aliceLaptop.phone!

          const changeKeys = () => {
            const newKeys = createKeyset({ type: KeyType.USER, name: aliceLaptop.userId })
            aliceLaptop.team.changeKeys(newKeys)
          }

          // Alice rotates her keys two times
          changeKeys()
          changeKeys()

          // key rotation results in two new generations of keys
          expect(aliceLaptop.team.teamKeys().generation).toBe(2)
          expect(aliceLaptop.team.adminKeys().generation).toBe(2)
          expect(aliceLaptop.team.members(aliceLaptop.userId).keys.generation).toBe(2)
          expect(aliceLaptop.user.keys.generation).toBe(2)

          expect(Object.values(aliceLaptop.team.teamKeyring())).toHaveLength(3) // 3 generations of team keys
          expect(Object.values(aliceLaptop.team.userKeyring())).toHaveLength(3) // 3 generations of user keys

          // 3 generations each of team keys, admin keys, alice user keys = 9 keys total
          expect(aliceLaptop.team.state.lockboxes.length).toBe(9)

          // Alice invites and admits her phone
          const { seed } = aliceLaptop.team.inviteDevice()
          const proofOfInvitation = generateProof(seed)
          aliceLaptop.team.admitDevice(proofOfInvitation, redactDevice(alicePhone))

          // upon creating the invitation, Alice's laptop added 3 lockboxes containing 3 generations
          // of user keys that can be opened by Alice's phone using the starter keys
          expect(aliceLaptop.team.state.lockboxes.length).toBe(12)

          // the laptop sends the phone the team's graph and keyring
          const serializedGraph = aliceLaptop.team.save()
          const teamKeyring = aliceLaptop.team.teamKeyring()

          // 📱 Alice's phone needs to get her user keys.

          // Alice's laptop also sends all generations of user keys in encrypted lockboxes for each key,
          // which Alice's phone decrypts using her starter keys generated from the invitation seed.
          // Alice's phone needs every generation of user keys to unlock every generation of team keys so
          // the phone can decrypt the whole team graph using all the secret keys of the team keys generations.
          const { user: aliceUser, userKeyring } = teams.getDeviceUserFromGraph({
            serializedGraph,
            teamKeyring,
            invitationSeed: seed,
          })

          // Alice's phone now has everything it needs to decrypt the team graph and join the team
          const phoneTeam = new Team({
            source: serializedGraph,
            context: { user: aliceUser, device: alicePhone },
            teamKeyring,
          })
          phoneTeam.join(teamKeyring, userKeyring)

          // ✅ Now Alice has 💻📱 two devices on the signature chain
          expect(phoneTeam.members(aliceLaptop.userId).devices).toHaveLength(2)
          expect(aliceLaptop.team.members(aliceLaptop.userId).devices).toHaveLength(2)

          // Alice's phone added 3 more lockboxes for 3 generations of user keys while joining,
          // this time using it's own secret device keys for encryption
          expect(phoneTeam.state.lockboxes.length).toBe(15)

          // Alice's phone has all user keys and team keys generations, the latest admin keys,
          // and the latest user keys
          expect(Object.values(phoneTeam.teamKeyring())).toHaveLength(3)
          expect(Object.values(phoneTeam.userKeyring())).toHaveLength(3)
          expect(phoneTeam.adminKeys().generation).toBe(2)
          expect(phoneTeam.members(aliceLaptop.userId).keys.generation).toBe(2)

          const serializedPhoneTeam = phoneTeam.save()

          // If we didn't have all the keys we needed, this would throw "Can't decrypt link: don't have the correct keyset"
          expect(
            () =>
              new Team({
                source: serializedPhoneTeam,
                context: { user: aliceUser, device: alicePhone },
                teamKeyring: phoneTeam.teamKeyring(),
              })
          ).not.toThrow()
        })
      })
    })
  })
})
