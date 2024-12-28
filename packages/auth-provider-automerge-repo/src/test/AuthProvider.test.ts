import { Repo, type PeerId } from '@automerge/automerge-repo'
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel'
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs'
import * as Auth from '@localfirst/auth'
import { eventPromise } from '@localfirst/shared'
import { getShareId } from '../getShareId.js'
import { type ShareId } from '../types.js'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../AuthProvider.js'
import { authenticated, authenticatedInTime } from './helpers/authenticated.js'
import { getStorageDirectory, setup, type UserStuff } from './helpers/setup.js'
import { synced } from './helpers/synced.js'

describe('auth provider for automerge-repo', () => {
  it('does not authenticate users that do not belong to any teams', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])

    const authWorked = await authenticatedInTime(alice, bob)
    expect(authWorked).toBe(false)

    teardown()
  })

  it('does not authenticate users that are not on the same team', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    const bobTeam = Auth.createTeam('b team', bob.context)
    await bob.authProvider.addTeam(bobTeam)

    const authWorked = await authenticatedInTime(alice, bob)
    expect(authWorked).toBe(false)

    teardown()
  })

  it('authenticates users that are already on the same team', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])

    const aliceTeam = await alice.authProvider.createTeam('team A')

    // Simulate Bob already being on Alice's team and having a copy of the team
    const bobTeam = putUserOnTeam(aliceTeam, bob)

    void bob.authProvider.addTeam(bobTeam)

    // they're able to authenticate and sync
    await authenticated(alice, bob)
    await synced(alice, bob)

    teardown()
  })

  it('authenticates an invited user', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    // Alice creates an invite code to send to Bob
    const { seed: bobInviteCode } = aliceTeam.inviteMember()

    // Bob uses the invitation to join
    void bob.authProvider.addInvitation({
      shareId: getShareId(aliceTeam),
      invitationSeed: bobInviteCode,
    })

    // they're able to authenticate and sync
    await authenticated(alice, bob)

    await synced(alice, bob)

    teardown()
  })

  it('authenticates an invited device', async () => {
    const channel = new MessageChannel()
    const { port1: laptopToPhone, port2: phoneToLaptop } = channel

    const alice = Auth.createUser('alice')

    const laptopStorage = new NodeFSStorageAdapter(getStorageDirectory('alice-laptop'))
    const laptop = Auth.createDevice({ userId: alice.userId, deviceName: "Alice's laptop" })
    const laptopContext = { user: alice, device: laptop }
    const laptopAuth = new AuthProvider({ ...laptopContext, storage: laptopStorage })

    const laptopAdapter = new MessageChannelNetworkAdapter(laptopToPhone)
    const laptopRepo = new Repo({
      network: [laptopAuth.wrap(laptopAdapter)],
      peerId: laptop.deviceId as PeerId,
    })

    const phoneStorage = new NodeFSStorageAdapter(getStorageDirectory('alice-phone'))

    // TODO: we're using userName instead of userId, because in the real world we don't know our userId yet.
    // We probably need to update the userId once we know it.
    const phone = Auth.createDevice({ userId: alice.userName, deviceName: "Alice's phone" })
    const phoneContext = { userName: alice.userName, device: phone }
    const phoneAuth = new AuthProvider({ ...phoneContext, storage: phoneStorage })

    const phoneAdapter = new MessageChannelNetworkAdapter(phoneToLaptop)
    const phoneRepo = new Repo({
      network: [phoneAuth.wrap(phoneAdapter)],
      peerId: phone.deviceId as PeerId,
    })

    // Alice creates team A on her laptop
    const team = Auth.createTeam('team A', laptopContext)
    await laptopAuth.addTeam(team)

    // She creates an invitation code for her phone
    const { seed: phoneInviteCode } = team.inviteDevice()

    await phoneAuth.addInvitation({
      shareId: getShareId(team),
      userName: alice.userName,
      invitationSeed: phoneInviteCode,
    })

    // Alice's phone is able to authenticate using the invitation
    await Promise.all([
      eventPromise(laptopRepo.networkSubsystem, 'peer'),
      eventPromise(phoneRepo.networkSubsystem, 'peer'),
    ])

    laptopToPhone.close()
    phoneToLaptop.close()
  })

  it('does not authenticate a user with the wrong code', async () => {
    const {
      users: { alice, eve },
      teardown,
    } = setup(['alice', 'eve'])

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    // Alice sends Bob an invitation
    const { seed: _bobInvite } = aliceTeam.inviteMember()

    // Eve knows Bob has been invited but doesn't know the code
    await eve.authProvider.addInvitation({
      shareId: getShareId(aliceTeam),
      invitationSeed: 'passw0rd',
    })

    // alice learns that eve should kick rocks
    const { message: aliceMessage } = await eventPromise(alice.authProvider, 'localError')
    expect(aliceMessage).toBe("The peer's invitation wasn't accepted")

    // eve gets told to kick rocks
    const { message: eveMessage } = await eventPromise(eve.authProvider, 'remoteError')
    expect(eveMessage).toBe("Your invitation wasn't accepted")

    teardown()
  })

  it('syncs permissions changes', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    // Simulate Bob already being on Alice's team and having a copy of the team
    const bobTeam = putUserOnTeam(aliceTeam, bob)
    await bob.authProvider.addTeam(bobTeam)

    // there's only one role on the team by default (ADMIN)
    expect(bobTeam.roles()).toHaveLength(1)

    // Alice adds a role
    aliceTeam.addRole('MANAGERS')

    // Bob sees the change
    await eventPromise(bobTeam, 'updated')
    expect(bobTeam.roles()).toHaveLength(2) // ✅

    teardown()
  })

  it('works with three peers all directly connected', async () => {
    const {
      users: { alice, bob, charlie },
      teardown,
    } = setup(['alice', 'bob', 'charlie'])

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    // Simulate Bob and Charlie already being on Alice's team and having a copy of the team
    void bob.authProvider.addTeam(putUserOnTeam(aliceTeam, bob))
    void charlie.authProvider.addTeam(putUserOnTeam(aliceTeam, charlie))

    // they're able to authenticate and sync
    await Promise.all([
      authenticated(alice, bob),
      authenticated(charlie, bob),
      authenticated(alice, charlie),
    ])

    await Promise.all([synced(alice, bob), synced(alice, charlie), synced(bob, charlie)]) // ✅

    teardown()
  })

  it('works with four peers all directly connected', async () => {
    const {
      users: { alice, bob, charlie, dwight },
      teardown,
    } = setup(['alice', 'bob', 'charlie', 'dwight'])

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    // Simulate the others already being on Alice's team and having a copy of the team
    void bob.authProvider.addTeam(putUserOnTeam(aliceTeam, bob))
    void charlie.authProvider.addTeam(putUserOnTeam(aliceTeam, charlie))
    void dwight.authProvider.addTeam(putUserOnTeam(aliceTeam, dwight))

    // they're able to authenticate and sync

    const authWorked = await Promise.all([
      authenticatedInTime(alice, bob),
      authenticatedInTime(charlie, bob),
      authenticatedInTime(alice, charlie),
      authenticatedInTime(alice, dwight),
      authenticatedInTime(bob, dwight),
      authenticatedInTime(charlie, dwight),
    ])
    expect(authWorked.every(Boolean)).toBe(true)

    await Promise.all([
      synced(alice, bob),
      synced(alice, charlie),
      synced(bob, charlie),
      synced(alice, dwight),
      synced(bob, dwight),
      synced(charlie, dwight),
    ]) // ✅

    teardown()
  })

  it('persists local context and team state (including the complete keyring)', async () => {
    const {
      users: { alice, bob, charlie },
      teardown,
    } = setup(['alice', 'bob', 'charlie'])

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    // Alice sends Charlie an invitation
    const { seed: charlieInvite } = aliceTeam.inviteMember()

    // Charlie uses the invitation to join
    await charlie.authProvider.addInvitation({
      shareId: getShareId(aliceTeam),
      invitationSeed: charlieInvite,
    })

    // they're able to authenticate and sync
    await authenticated(alice, charlie)
    await synced(alice, charlie) // ✅

    // Alice boots charlie
    aliceTeam.remove(charlie.user.userId)

    // Alice sends Bob an invitation
    const { seed: bobInvite } = aliceTeam.inviteMember()

    // Bob uses the invitation to join
    await bob.authProvider.addInvitation({
      shareId: getShareId(aliceTeam),
      invitationSeed: bobInvite,
    })

    // they're able to authenticate and sync
    await authenticated(alice, bob)
    await synced(alice, bob) // ✅

    // Alice and Bob both close and reopen their apps

    // reconnect via a new channel
    const channel = new MessageChannel()
    const { port1: aliceToBob, port2: bobToAlice } = channel

    // instantiate new authProviders and repos using this channel
    const alice2 = alice.restart([aliceToBob])
    const bob2 = bob.restart([bobToAlice])

    // they're able to authenticate and sync
    await authenticated(alice2, bob2)
    await synced(alice2, bob2) // ✅

    teardown()
  })

  it('removes a share and deletes it from storage', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])
    const aliceTeam = Auth.createTeam('team A', alice.context)

    // Alice and Bob are able to connect
    await alice.authProvider.addTeam(aliceTeam)
    const { seed: bobInvite } = aliceTeam.inviteMember()
    await bob.authProvider.addInvitation({
      shareId: getShareId(aliceTeam),
      invitationSeed: bobInvite,
    })
    await authenticated(alice, bob)
    await synced(alice, bob) // ✅

    // They reload and still can connect (because the share is persisted)
    {
      const channel = new MessageChannel()
      const { port1: aliceToBob, port2: bobToAlice } = channel
      const alice2 = alice.restart([aliceToBob])
      const bob2 = bob.restart([bobToAlice])
      await authenticated(alice2, bob2)
      await synced(alice2, bob2) // ✅
    }

    // Bob deletes the share; this time they can't connect
    {
      const shareId = getShareId(aliceTeam)
      await bob.authProvider.removeShare(shareId) // 👈 Bob deletes the share
      const channel = new MessageChannel()
      const { port1: aliceToBob, port2: bobToAlice } = channel
      const alice2 = alice.restart([aliceToBob])
      const bob2 = bob.restart([bobToAlice])
      const authWorked = await authenticatedInTime(alice2, bob2)
      expect(authWorked).toBe(false) // ❌
    }
    teardown()
  })

  it('allows peers to connect without authenticating via a public share', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])

    const shareId = 'public-share-1' as ShareId
    void alice.authProvider.joinPublicShare(shareId)
    void bob.authProvider.joinPublicShare(shareId)

    const authWorked = await authenticatedInTime(alice, bob)
    expect(authWorked).toBe(true)
    await synced(alice, bob)

    teardown()
  })

  it('persists public shares', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])

    const shareId = 'public-share-2' as ShareId
    void alice.authProvider.joinPublicShare(shareId)

    void bob.authProvider.joinPublicShare(shareId)

    await authenticated(alice, bob)
    await synced(alice, bob)

    // Alice and Bob both close and reopen their apps

    // reconnect via a new channel
    const channel = new MessageChannel()
    const { port1: aliceToBob, port2: bobToAlice } = channel

    // instantiate new authProviders and repos using this channel
    const alice2 = alice.restart([aliceToBob])
    const bob2 = bob.restart([bobToAlice])

    // they're able to authenticate and sync
    await authenticated(alice2, bob2)
    await synced(alice2, bob2)

    teardown()
  })
})

// HELPERS

const putUserOnTeam = (team: Auth.Team, b: UserStuff) => {
  team.addForTesting(b.user, [], Auth.redactDevice(b.device))
  const serializedTeam = team.save()
  const keys = team.teamKeys()
  return Auth.loadTeam(serializedTeam, b.context, keys)
}
