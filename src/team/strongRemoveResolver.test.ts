import * as chains from '/chain'
import { clone, getSequence, merge } from '/chain'
import { strongRemoveResolver } from '/team/strongRemoveResolver'
import { TeamAction, TeamActionLink, TeamSignatureChain } from '/team/types'
import { redactUser } from '/user'
import { alice, alicesContext, bobsContext, charlie, MANAGERS } from '/util/testing'

describe('teams', () => {
  describe('strongRemoveResolver', () => {
    const setup = () => {
      let aliceChain = chains.create<TeamAction>(
        { teamName: 'Spies Я Us', rootMember: redactUser(alice) },
        alicesContext
      )
      let bobChain = clone(aliceChain)
      return { aliceChain, bobChain }
    }

    const expectMergedResult = (
      aChain: TeamSignatureChain,
      bChain: TeamSignatureChain,
      expected: string[][] | string[]
    ) => {
      // 👩🏾 ⇄ 👨‍🦲 They synchronize chains
      bChain = merge(bChain, aChain)
      aChain = merge(aChain, bChain)

      // 👩🏾 == 👨‍🦲 They should now end up with the same sequence
      const aSequence = sequence(aChain)
      const bSequence = sequence(bChain)
      expect(aSequence).toEqual(bSequence)

      // `expected` can be one sequence or multiple sequence options
      // coerce to array of sequences
      if (!Array.isArray(expected[0])) expected = [expected] as string[][]

      // The sequence should match one of the provided options
      expect(expected).toContainEqual(aSequence)
    }

    it('should resolve two chains with no conflicting membership changes', () => {
      // 👩🏾 🡒 👨‍🦲 Alice creates a chain and shares it with Bob
      let { aliceChain, bobChain } = setup()

      // 🔌 Now Alice and Bob are disconnected

      // 👨‍🦲 Bob makes a change
      bobChain = chains.append(
        bobChain,
        { type: 'ADD_ROLE', payload: { roleName: 'MANAGERS' } },
        bobsContext
      )
      expect(sequence(bobChain)).toEqual(['ROOT', 'ADD_ROLE MANAGERS'])

      // 👩🏾 Concurrently, Alice makes a change
      aliceChain = chains.append(
        aliceChain,
        { type: 'ADD_MEMBER', payload: { member: redactUser(charlie) } },
        alicesContext
      )
      expect(sequence(aliceChain)).toEqual(['ROOT', 'ADD_MEMBER charlie'])

      // 🔄 Alice and Bob reconnect and synchronize chains

      // ✅ the result will be one of these two (could be either because timestamps change with each test run)
      expectMergedResult(aliceChain, bobChain, [
        ['ROOT', 'ADD_MEMBER charlie', 'ADD_ROLE MANAGERS'],
        ['ROOT', 'ADD_ROLE MANAGERS', 'ADD_MEMBER charlie'],
      ])
    })

    it('should discard changes made by a member who is concurrently removed', () => {
      // 👩🏾 🡒 👨‍🦲 Alice creates a chain and shares it with Bob
      let { aliceChain, bobChain } = setup()

      // 🔌 Now Alice and Bob are disconnected

      // 👨‍🦲 Bob makes a change
      bobChain = chains.append(
        bobChain,
        { type: 'ADD_MEMBER', payload: { member: redactUser(charlie) } },
        bobsContext
      )
      expect(sequence(bobChain)).toEqual(['ROOT', 'ADD_MEMBER charlie'])

      // 👩🏾 but concurrently, Alice removes Bob from the admin role
      aliceChain = chains.append(
        aliceChain,
        { type: 'REMOVE_MEMBER_ROLE', payload: { userName: 'bob', roleName: MANAGERS } },
        alicesContext
      )
      expect(sequence(aliceChain)).toEqual(['ROOT', 'REMOVE_MEMBER_ROLE managers bob'])

      // 🔄 Alice and Bob reconnect and synchronize chains

      // ✅ Bob's change is discarded
      expectMergedResult(aliceChain, bobChain, ['ROOT', 'REMOVE_MEMBER_ROLE managers bob'])
    })
  })
})

// utility function to get a chain's sequence using `strongRemoveResolver`
// and represent it as an array of strings
const sequence = (chain: TeamSignatureChain) =>
  getSequence({ chain, resolver: strongRemoveResolver }).map((l: TeamActionLink) => {
    const summary =
      l.body.type === 'ADD_MEMBER'
        ? l.body.payload.member.userName
        : l.body.type === 'ADD_ROLE'
        ? l.body.payload.roleName
        : l.body.type === 'REMOVE_MEMBER_ROLE'
        ? `${l.body.payload.roleName} ${l.body.payload.userName}`
        : ''
    return `${l.body.type} ${summary}`.trim()
  })
