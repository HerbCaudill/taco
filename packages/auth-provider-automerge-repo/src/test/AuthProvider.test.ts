import { Repo, type PeerId } from '@automerge/automerge-repo'
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel'
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs'
import * as Auth from '@localfirst/auth'
import { eventPromise } from '@localfirst/auth-shared'
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

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    // Simulate Bob already being on Alice's team and having a copy of the team
    const bobTeam = putUserOnTeam(aliceTeam, bob)
    await bob.authProvider.addTeam(bobTeam)

    // they're able to authenticate and sync
    const authWorked = await authenticatedInTime(alice, bob)
    expect(authWorked).toBe(true)

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
    await bob.authProvider.addInvitation({
      shareId: aliceTeam.id,
      invitationSeed: bobInviteCode,
    })

    // they're able to authenticate and sync
    const authWorked = await authenticatedInTime(alice, bob)
    expect(authWorked).toBe(true)

    await synced(alice, bob)

    teardown()
  })

  it('authenticates an invited device', async () => {
    const channel = new MessageChannel()
    const { port1: laptopToPhone, port2: phoneToLaptop } = channel

    const alice = Auth.createUser('alice')

    const laptopStorage = new NodeFSStorageAdapter(getStorageDirectory('alice-laptop'))
    const laptop = Auth.createDevice(alice.userId, "Alice's laptop")
    const laptopContext = { user: alice, device: laptop }
    const laptopAuth = new AuthProvider({ ...laptopContext, storage: laptopStorage })

    const laptopAdapter = new MessageChannelNetworkAdapter(laptopToPhone)
    const laptopRepo = new Repo({
      network: [laptopAuth.wrap(laptopAdapter)],
      peerId: laptop.deviceId as PeerId,
    })

    const phoneStorage = new NodeFSStorageAdapter(getStorageDirectory('alice-phone'))
    const phone = Auth.createDevice(alice.userId, "Alice's phone")
    const phoneContext = { user: alice, device: phone }
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
      shareId: team.id,
      userId: alice.userId,
      userName: alice.userName,
      invitationSeed: phoneInviteCode,
    })

    // Alice's phone is able to authenticate using the invitation
    await authenticated(laptopRepo, phoneRepo) // ✅

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
      shareId: aliceTeam.id,
      invitationSeed: 'passw0rd',
    })

    // grrr foiled again
    const authWorked = await authenticatedInTime(alice, eve)
    expect(authWorked).toBe(false) // ✅

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
    await bob.authProvider.addTeam(putUserOnTeam(aliceTeam, bob))
    await charlie.authProvider.addTeam(putUserOnTeam(aliceTeam, charlie))

    // they're able to authenticate and sync

    const authWorked = await Promise.all([
      authenticatedInTime(alice, bob),
      authenticatedInTime(charlie, bob),
      authenticatedInTime(alice, charlie),
    ])
    expect(authWorked.every(Boolean)).toBe(true)

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
    await bob.authProvider.addTeam(putUserOnTeam(aliceTeam, bob))
    await charlie.authProvider.addTeam(putUserOnTeam(aliceTeam, charlie))
    await dwight.authProvider.addTeam(putUserOnTeam(aliceTeam, dwight))

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

  it('persists local context and team state', async () => {
    const {
      users: { alice, bob },
      teardown,
    } = setup(['alice', 'bob'])

    const aliceTeam = Auth.createTeam('team A', alice.context)
    await alice.authProvider.addTeam(aliceTeam)

    // Alice sends Bob an invitation
    const { seed: bobInvite } = aliceTeam.inviteMember()

    // Bob uses the invitation to join
    await bob.authProvider.addInvitation({
      shareId: aliceTeam.id,
      invitationSeed: bobInvite,
    })

    // they're able to authenticate and sync
    const authWorked = await authenticatedInTime(alice, bob)
    expect(authWorked).toBe(true) // ✅
    await synced(alice, bob) // ✅

    // Alice and Bob both close and reopen their apps

    // reconnect via a new channel
    const channel = new MessageChannel()
    const { port1: aliceToBob, port2: bobToAlice } = channel

    // instantiate new authProviders and repos using this channel
    const alice2 = alice.restart([aliceToBob])
    const bob2 = bob.restart([bobToAlice])

    // they're able to authenticate and sync
    const authWorkedAgain = await authenticatedInTime(alice2, bob2)
    expect(authWorkedAgain).toBe(true) // ✅
    await synced(alice2, bob2) // ✅

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
