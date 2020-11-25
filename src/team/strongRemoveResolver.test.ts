import * as chains from '/chain'
import { clone, getSequence, merge } from '/chain'
import { strongRemoveResolver as resolver } from '/team/strongRemoveResolver'
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

      // 🔄 Alice and Bob reconnect

      // 👩🏾 ⇄ 👨‍🦲 They synchronize chains
      bobChain = merge(bobChain, aliceChain)
      aliceChain = merge(aliceChain, bobChain)

      // Their chains now produce the same sequence
      expect(sequence(bobChain)).toEqual(sequence(aliceChain))

      // the result will be one of these two (could be either because timestamps change with each test run)
      expect([
        ['ROOT', 'ADD_MEMBER charlie', 'ADD_ROLE MANAGERS'],
        ['ROOT', 'ADD_ROLE MANAGERS', 'ADD_MEMBER charlie'],
      ]).toContainEqual(sequence(bobChain))
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

      // 🔄 Alice and Bob reconnect

      // 👩🏾 ⇄ 👨‍🦲 They synchronize chains
      bobChain = merge(bobChain, aliceChain)
      aliceChain = merge(aliceChain, bobChain)

      // Their chains now produce the same sequence
      expect(sequence(bobChain)).toEqual(sequence(aliceChain))

      // Bob's change should be discarded
      expect(sequence(aliceChain)).toEqual(['ROOT', 'REMOVE_MEMBER_ROLE managers bob'])
    })
  })
})

const sequence = (chain: TeamSignatureChain) => getSequence({ chain, resolver }).map(linkSummary)

const linkSummary = (l: TeamActionLink) => {
  const summary =
    l.body.type === 'ADD_MEMBER'
      ? l.body.payload.member.userName
      : l.body.type === 'ADD_ROLE'
      ? l.body.payload.roleName
      : l.body.type === 'REMOVE_MEMBER_ROLE'
      ? `${l.body.payload.roleName} ${l.body.payload.userName}`
      : ''
  return `${l.body.type} ${summary}`.trim()
}
