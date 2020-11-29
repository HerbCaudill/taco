import { asymmetric } from '@herbcaudill/crypto'
import { InitialContext } from './types'
import { Connection } from '/connection'
import {
  ChallengeIdentityMessage,
  ConnectionMessage,
  HelloMessage,
  ProveIdentityMessage,
} from '/connection/message'
import { LocalUserContext } from '/context'
import { redactDevice } from '/device'
import * as identity from '/connection/identity'
import { acceptMemberInvitation } from '/invitation'
import { KeyType, randomKey, redactKeys } from '/keyset'
import { ADMIN } from '/role'
import * as teams from '/team'
import * as users from '/user'
import { redactUser, User } from '/user'
import { arrayToMap } from '/util/arrayToMap'
import { alice, bob, charlie, joinTestChannel, TestChannel } from '/util/testing'
import '/util/testing/expect/toBeValid'

describe('connection', () => {
  // used for tests of the connection's timeout - needs to be bigger than
  // the TIMEOUT_DELAY constant in connectionMachine, plus some slack
  const LONG_TIMEOUT = 10000

  const oneWay = true
  const setup = (userNames: string[] = [], isOneWay = false) => {
    const allTestUsers: Record<string, User> = { alice, bob, charlie }
    const getUserContext = (userName: string): LocalUserContext => {
      const user = allTestUsers[userName]
      return { user }
    }

    // Our dummy `sendMessage` just pushes messages onto a queue. We use this for one-sided tests
    // (where there's only a realy connection on one side)
    const messageQueue: ConnectionMessage[] = []
    const sendMessage = (message: ConnectionMessage) => messageQueue.push(message)
    const lastMessage = () => messageQueue[messageQueue.length - 1]

    // For real two-way connections, we use this
    const join = joinTestChannel(new TestChannel())

    // Create a new team
    const team = teams.create('Spies Я Us', getUserContext('alice'))

    //  Always add Bob as an admin
    team.add(bob, [ADMIN])

    const makeUserStuff = (userName: string) => {
      const user = allTestUsers[userName]
      const context = getUserContext(userName)
      const device = redactDevice(user.device)
      const userTeam = teams.load(team.chain, context)
      const connectionContext = { team: userTeam, user, device }
      const connection = isOneWay
        ? new Connection({ sendMessage, context: connectionContext })
        : join(connectionContext)
      const getState = () => connection.state as any

      let index = 0
      const deliver = (msg: ConnectionMessage) => connection.deliver({ index: index++, ...msg })

      return {
        userName,
        user,
        context,
        device,
        team: userTeam,
        connectionContext,
        connection,
        getState,
        deliver,
      }
    }

    const testUsers: Record<string, ReturnType<typeof makeUserStuff>> = userNames
      .map(makeUserStuff)
      .reduce(arrayToMap('userName'), {})

    return { sendMessage, join, lastMessage, testUsers }
  }

  describe('between members', () => {
    // Test one side of the verification workflow, using a real connection for Alice and manually simulating Bob's messages.
    it(`should successfully verify the other peer's identity`, async () => {
      const { testUsers, lastMessage } = setup(['alice'], oneWay)
      const { alice } = testUsers

      const authenticatingState = () => alice.getState().connecting.authenticating

      // 👩🏾 Alice connects
      alice.connection.start()

      // 👨‍🦲 Bob sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
      alice.deliver({ type: 'HELLO', payload: { identityClaim } })

      // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
      expect(authenticatingState().verifyingTheirIdentity).toEqual('awaitingIdentityProof')

      // 👨‍🦲 Bob generates proof by signing Alice's challenge and sends it back
      const challengeMessage = lastMessage() as ChallengeIdentityMessage
      const { challenge } = challengeMessage.payload
      const proof = identity.prove(challenge, bob.keys)
      alice.deliver({ type: 'PROVE_IDENTITY', payload: { challenge, proof } })

      // ✅ Success! Alice has verified Bob's identity
      expect(authenticatingState().verifyingTheirIdentity).toEqual('done')
    })

    // Test the other side, using a real connection for Bob and manually simulating Alice's messages.
    it(`should successfully prove our identity to the other peer`, async () => {
      const { testUsers, lastMessage } = setup(['alice', 'bob'], oneWay)
      const { bob } = testUsers
      const bobAuthenticatingState = () => bob.getState().connecting.authenticating

      // 👨‍🦲 Bob connects
      bob.connection.start()

      // 👩🏾 Alice sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'alice' }
      bob.deliver({ type: 'HELLO', payload: { identityClaim } })

      // 👨‍🦲 Bob automatically asserts his identity, and awaits a challenge
      expect(bobAuthenticatingState().provingOurIdentity).toEqual('awaitingIdentityChallenge')

      // 👩🏾 Alice challenges Bob's identity claim
      const helloMessage = lastMessage() as HelloMessage
      const challenge = identity.challenge(helloMessage.payload.identityClaim)
      bob.deliver({ type: 'CHALLENGE_IDENTITY', payload: { challenge } })

      // 👨‍🦲 Bob automatically responds to the challenge with proof, and awaits acceptance
      expect(bobAuthenticatingState().provingOurIdentity).toEqual('awaitingIdentityAcceptance')

      // 👩🏾 Alice verifies Bob's proof
      const proofMessage = lastMessage() as ProveIdentityMessage
      const peerKeys = redactKeys(bob.user.keys)
      const validation = identity.verify(challenge, proofMessage.payload.proof, peerKeys)
      expect(validation).toBeValid()

      // 👩🏾 Alice generates a acceptance message and sends it to Bob
      const encryptedSeed = asymmetric.encrypt({
        secret: randomKey(),
        recipientPublicKey: peerKeys.encryption,
        senderSecretKey: alice.keys.encryption.secretKey,
      })
      bob.deliver({ type: 'ACCEPT_IDENTITY', payload: { encryptedSeed } })

      // ✅ Success! Bob has proved his identity
      expect(bobAuthenticatingState().provingOurIdentity).toEqual('done')
    })

    // Let both processes play out automatically
    it('should automatically connect two members', async () => {
      const { testUsers } = setup(['alice', 'bob'])
      const { alice, bob } = testUsers

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      alice.connection.start()
      bob.connection.start()

      // ✅ They're both connected
      await expectConnection([alice.connection, bob.connection])

      // Alice stops the connection
      alice.connection.stop()
      expect(alice.connection.state).toEqual('disconnected')
      await expectDisconnection([bob.connection])
    })

    it(`shouldn't connect with a member who has been removed`, async () => {
      const { testUsers } = setup(['alice', 'bob'])
      const { alice, bob } = testUsers

      // 👩🏾 Alice removes Bob
      alice.team.remove('bob')

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      alice.connection.start()
      bob.connection.start()

      // ❌ The connection fails
      await expectDisconnection([alice.connection, bob.connection])
    })

    it(`shouldn't connect with someone who doesn't belong to the team`, async () => {
      const { testUsers } = setup(['alice', 'charlie'])
      const { alice, charlie } = testUsers

      // Alice connects
      alice.connection.start()

      // Charlie tries to connect
      charlie.connection.start()

      // ❌ The connection fails
      await expectDisconnection([alice.connection, charlie.connection])
    })

    it(
      'disconnects if the peer stops responding',
      async () => {
        const { testUsers } = setup(['alice', 'bob'], oneWay)
        const { alice } = testUsers

        // 👩🏾 Alice connects
        alice.connection.start()

        // 👨‍🦲 Bob sends a hello message
        const identityClaim = { type: KeyType.MEMBER, name: 'bob' }
        alice.connection.deliver({
          index: 0,
          type: 'HELLO',
          payload: { identityClaim },
        })

        // 👩🏾 Alice automatically sends Bob a challenge & waits for proof
        expect(alice.getState().connecting.authenticating.verifyingTheirIdentity).toEqual(
          'awaitingIdentityProof'
        )

        // 👨‍🦲 Bob doesn't respond
        // ...
        // ...
        // ...

        // ❌ The connection fails
        await expectDisconnection([alice.connection], 'timed out')
      },
      LONG_TIMEOUT
    )
  })

  describe('with invitation', () => {
    // Test one side of the verification workflow with Charlie presenting an invitation, using a real
    // connection for Alice and manually simulating Charlie's messages.
    it(`should successfully verify the other peer's invitation`, async () => {
      const { testUsers, lastMessage } = setup(['alice'], oneWay)
      const { alice } = testUsers
      const aliceAuthenticatingState = () => alice.getState().connecting.authenticating

      // 👩🏾 Alice invites 👳‍♂️ Charlie
      const { secretKey: invitationSecretKey } = alice.team.invite('charlie')

      // 👩🏾 Alice connects
      alice.connection.start()

      // 👳‍♂️ Charlie sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'charlie' }
      const proofOfInvitation = acceptMemberInvitation(invitationSecretKey, redactUser(charlie))
      alice.deliver({ type: 'HELLO', payload: { identityClaim, proofOfInvitation } })

      // 👩🏾 Alice automatically validates the invitation
      expect(aliceAuthenticatingState().verifyingTheirIdentity).toEqual('awaitingIdentityProof')

      // 👳‍♂️ Charlie generates proof by signing Alice's challenge and sends it back
      const challengeMessage = lastMessage() as ChallengeIdentityMessage
      const { challenge } = challengeMessage.payload
      const proof = identity.prove(challenge, charlie.keys)
      alice.connection.deliver({ index: 1, type: 'PROVE_IDENTITY', payload: { challenge, proof } })

      // ✅ Success! Alice has verified Charlie's identity
      expect(aliceAuthenticatingState().verifyingTheirIdentity).toEqual('done')
    })

    // Test the other side with Charlie presenting an invitation, using a real connection for Bob
    // and manually simulating Alice's messages.
    it(`should successfully present an invitation to the other peer`, async () => {
      const { testUsers, lastMessage, sendMessage } = setup(['alice'], oneWay)
      const { alice } = testUsers

      // 👩🏾 Alice invites 👳‍♂️ Charlie

      const { secretKey: invitationSecretKey } = alice.team.invite('charlie')

      // 👳‍♂️ Charlie connects
      const charlieContext = {
        user: charlie,
        device: redactDevice(charlie.device),
        invitationSecretKey,
      } as InitialContext
      const charlieConnection = new Connection({ sendMessage, context: charlieContext })
      charlieConnection.start()

      // 👩🏾 Alice sends a hello message
      const identityClaim = { type: KeyType.MEMBER, name: 'alice' }
      charlieConnection.deliver({ index: 0, type: 'HELLO', payload: { identityClaim } })

      // 👳‍♂️ Charlie awaits acceptance
      const charlieState = () => (charlieConnection.state as any).connecting
      expect(charlieState().maybeHandlingInvitations).toEqual('awaitingInvitationAcceptance')

      // 👩🏾 Alice validates charlie's invitation
      const helloMessage = lastMessage() as HelloMessage
      const { proofOfInvitation } = helloMessage.payload
      alice.team.admitMember(proofOfInvitation!)
      const chain = alice.team.save()
      charlieConnection.deliver({ index: 1, type: 'ACCEPT_INVITATION', payload: { chain } })

      // 👩🏾 Alice challenges charlie's identity claim
      const challenge = identity.challenge(helloMessage.payload.identityClaim)
      charlieConnection.deliver({ index: 2, type: 'CHALLENGE_IDENTITY', payload: { challenge } })

      // 👳‍♂️ Charlie automatically responds to the challenge with proof, and awaits acceptance
      expect(charlieState().authenticating.provingOurIdentity).toEqual('awaitingIdentityAcceptance')

      // 👩🏾 Alice verifies Charlie's proof
      const proofMessage = lastMessage() as ProveIdentityMessage
      const peerKeys = redactKeys(charlie.keys)
      const validation = identity.verify(challenge, proofMessage.payload.proof, peerKeys)
      expect(validation).toBeValid()

      // 👩🏾 Alice generates a acceptance message and sends it to charlie
      const userKeys = alice.user.keys
      const encryptedSeed = asymmetric.encrypt({
        secret: randomKey(),
        recipientPublicKey: peerKeys.encryption,
        senderSecretKey: userKeys.encryption.secretKey,
      })
      charlieConnection.deliver({ index: 3, type: 'ACCEPT_IDENTITY', payload: { encryptedSeed } })

      // ✅ Success! Charlie has proved his identity
      expect(charlieState().authenticating.provingOurIdentity).toEqual('done')
    })

    // Create real connections with a member on one side and an invitee on the other
    it('should automatically connect an invitee with a member', async () => {
      const { testUsers, join } = setup(['alice'])
      const { alice } = testUsers

      // 👩🏾 Alice invites 👳‍♂️ Charlie
      const { secretKey: invitationSecretKey } = alice.team.invite('charlie')

      // 👳‍♂️ Charlie uses the invitation secret key to connect with Alice
      const charlieContext = {
        user: charlie,
        device: redactDevice(charlie.device),
        invitationSecretKey,
      }
      const charlieConnection = join(charlieContext)

      // ✅ Success
      await expectConnection([charlieConnection, alice.connection])
    })

    it.todo(`What if someone concurrently presents their invitation to two different members?`)

    // Two people carrying invitations can't connect to each other - there needs to be at least one
    // current member in a connection in order to let the invitee in.
    it(`shouldn't allow two invitees to connect`, async () => {
      const { testUsers, join } = setup(['alice'], oneWay)
      const { alice } = testUsers

      // 👩🏾 Alice invites 👨‍🦲 Bob
      const { secretKey: bobKey } = alice.team.invite('bob')

      // 👩🏾 Alice invites 👳‍♂️ Charlie
      const { secretKey: charlieKey } = alice.team.invite('charlie')

      // 👨‍🦲 Bob uses his invitation secret key to try to connect
      const bobContext = {
        user: bob,
        device: redactDevice(bob.device),
        invitationSecretKey: bobKey,
      }
      const bobConnection = join(bobContext)

      // 👳‍♂️ Charlie does the same
      const charlieContext = {
        user: charlie,
        device: redactDevice(charlie.device),
        invitationSecretKey: charlieKey,
      }
      const charlieConnection = join(charlieContext)

      // ❌ The connection fails
      await expectDisconnection([bobConnection, charlieConnection], `neither one`)
    })

    // In which Eve tries to get Charlie to join her team instead of Alice's
    it(`shouldn't be fooled into joining the wrong team`, async () => {
      const { testUsers, sendMessage } = setup(['alice'], oneWay)
      const { alice } = testUsers

      // 👩🏾 Alice invites 👳‍♂️ Charlie

      const { secretKey: invitationSecretKey } = alice.team.invite('charlie')
      // 🦹‍♀️ Eve is going to impersonate Alice to try to get Charlie to join her team instead

      const fakeAlice = users.create('alice')
      const eveContext = { user: fakeAlice, device: alice.device }
      const eveTeam = teams.create('Spies Я Us', eveContext)

      // 🦹‍♀️ Eve creates an bogus invitation for Charlie in her signature chain
      eveTeam.invite('charlie')

      // 👳‍♂️ Charlie connects
      const charlieContext = {
        user: charlie,
        device: redactDevice(charlie.device),
        invitationSecretKey,
      } as InitialContext
      const charlieConnection = new Connection({ sendMessage, context: charlieContext })
      charlieConnection.start()

      // 🦹‍♀️ Eve sends a hello message pretending to be Alice
      const identityClaim = { type: KeyType.MEMBER, name: 'alice' }
      charlieConnection.deliver({ index: 0, type: 'HELLO', payload: { identityClaim } })

      //  👳‍♂️ Charlie is waiting for fake Alice to accept his invitation
      const charlieState = () => charlieConnection.state as any
      expect(charlieState().connecting.maybeHandlingInvitations).toEqual(
        'awaitingInvitationAcceptance'
      )

      // 🦹‍♀️ Eve pretends to validate Charlie's invitation
      const chain = eveTeam.save()
      charlieConnection.deliver({ index: 1, type: 'ACCEPT_INVITATION', payload: { chain } })

      // 👳‍♂️ Charlie won't see his invitation in Eve's team's sigchain, so he'll bail when he receives the welcome message
      expect(charlieState()).toEqual('disconnected')
      expect(charlieConnection.context.error!.message).toContain('not the team I was invited to')
    })
  })

  describe('update', () => {
    it('if they are behind, they will be caught up when they connect', async () => {
      const { testUsers } = setup(['alice', 'bob'])
      const { alice, bob } = testUsers

      // at this point, Alice and Bob have the same signature chain

      // 👩🏾 but now Alice does some stuff
      alice.team.add(redactUser(charlie))
      alice.team.addRole({ roleName: 'managers' })
      alice.team.addMemberRole('charlie', 'managers')

      // 👨‍🦲 Bob hasn't connected, so he doesn't have Alice's changes
      expect(bob.team.has('charlie')).toBe(false)
      expect(bob.team.hasRole('managersasdf')).toBe(false)

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      alice.connection.start()
      bob.connection.start()

      await expectConnection([alice.connection, bob.connection])

      // ✅ 👨‍🦲 Bob is up to date with Alice's changes
      expect(bob.team.has('charlie')).toBe(true)
      expect(bob.team.hasRole('managers')).toBe(true)
      expect(bob.team.memberHasRole('charlie', 'managers')).toBe(true)
    })

    it('if we are behind, we will be caught up when we connect', async () => {
      const { testUsers } = setup(['alice', 'bob'])
      const { alice, bob } = testUsers

      // at this point, Alice and Bob have the same signature chain

      // 👨‍🦲 but now Bob does some stuff
      bob.team.add(redactUser(charlie))
      bob.team.addRole({ roleName: 'managers' })
      bob.team.addMemberRole('charlie', 'managers')

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      alice.connection.start()
      bob.connection.start()

      await expectConnection([alice.connection, bob.connection])

      // ✅ 👩🏾 Alice is up to date with Bob's changes
      expect(alice.team.has('charlie')).toBe(true)
      expect(alice.team.hasRole('managers')).toBe(true)
      expect(alice.team.memberHasRole('charlie', 'managers')).toBe(true)
    })

    it(`if we've diverged, we will be caught up when we connect`, async () => {
      const { testUsers } = setup(['alice', 'bob'])
      const { alice, bob } = testUsers

      // at this point, Alice and Bob have the same signature chain

      // 👩🏾 but now Alice does some stuff
      alice.team.add(redactUser(charlie))
      alice.team.addRole({ roleName: 'managers' })
      alice.team.addMemberRole('charlie', 'managers')

      // 👨‍🦲 and Bob does some stuff
      bob.team.addRole({ roleName: 'finance' })
      bob.team.addMemberRole('alice', 'finance')

      // 👩🏾 👨‍🦲 Alice and Bob both join the channel
      alice.connection.start()
      bob.connection.start()

      await expectConnection([alice.connection, bob.connection])

      // 👨‍🦲 Bob is up to date with Alice's changes
      expect(bob.team.has('charlie')).toBe(true)
      expect(bob.team.hasRole('managers')).toBe(true)
      expect(bob.team.memberHasRole('charlie', 'managers')).toBe(true)

      // ✅ 👩🏾 and Alice is up to date with Bob's changes
      expect(alice.team.hasRole('finance')).toBe(true)
      expect(bob.team.memberHasRole('alice', 'finance')).toBe(true)
    })
  })

  /** Promisified event */
  const connectionEvent = (connections: Connection[], event: string) =>
    Promise.all(connections.map(c => new Promise(resolve => c.on(event, () => resolve()))))

  const expectConnection = async (connections: Connection[]) => {
    // ✅ They're both connected
    await connectionEvent(connections, 'connected')

    const firstKey = connections[0].context.sessionKey
    connections.forEach(connection => {
      expect(connection.state).toEqual('connected')
      // ✅ They've converged on a shared secret key
      expect(connection.context.sessionKey).toEqual(firstKey)
    })
  }

  const expectDisconnection = async (connections: Connection[], message?: string) => {
    // ✅ They're both disconnected
    await connectionEvent(connections, 'disconnected')
    connections.forEach(connection => {
      expect(connection.state).toEqual('disconnected')
      // ✅ If we're checking for a message, it matches
      if (message !== undefined) expect(connection.context.error!.message).toContain(message)
    })
  }
})
