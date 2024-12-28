import { append, merge } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { createTeam } from '../createTeam.js'
import { redactUser } from '../redactUser.js'
import { type TeamAction, type TeamGraph } from '../types.js'
import { ADMIN } from '../../role/index.js'
import { clone, graphSummary } from '../../util/index.js'
import { setup as userSetup } from '../../util/testing/index.js'

describe('membershipResolver', () => {
  const setup = () => {
    // 👩🏾 Alice creates a graph
    const aTeam = createTeam('Spies Я Us', alice.localContext)
    let aGraph = aTeam.graph
    const keys = aTeam.teamKeys()

    // 👩🏾 Alice adds 👨🏻‍🦲 Bob as admin
    aGraph = append({
      graph: aGraph,
      action: ADD_BOB_AS_ADMIN,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })

    // 👩🏾 🡒 👨🏻‍🦲 Alice shares the graph with Bob
    const bGraph: TeamGraph = clone(aGraph)
    return { aGraph, bGraph, keys }
  }

  it('resolves two graphs with no conflicting membership changes', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, keys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob makes a change
    bGraph = append({
      graph: bGraph,
      action: ADD_ROLE_MANAGERS,
      user: bob.user,
      context: bob.graphContext,
      keys,
    })
    expect(summary(bGraph)).toEqual('ROOT,ADD:bob,ADD:managers')

    // 👩🏾 Concurrently,Alice makes a change
    aGraph = append({
      graph: aGraph,
      action: ADD_CHARLIE,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })
    expect(summary(aGraph)).toEqual('ROOT,ADD:bob,ADD:charlie')

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ the result will be one of these two (could be either because timestamps change with each test run)
    expectMergedResult(aGraph, bGraph, [
      'ROOT,ADD:bob,ADD:charlie,ADD:managers',
      'ROOT,ADD:bob,ADD:managers,ADD:charlie',
    ])
  })

  it('discards changes made by a member who is concurrently removed', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, keys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob adds Charlie to the group
    bGraph = append({
      graph: bGraph,
      action: ADD_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      keys,
    })
    expect(summary(bGraph)).toEqual('ROOT,ADD:bob,ADD:charlie')

    // 👩🏾 but concurrently,Alice removes Bob from the group
    aGraph = append({
      graph: aGraph,
      action: REMOVE_BOB,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })
    expect(summary(aGraph)).toEqual('ROOT,ADD:bob,REMOVE:bob')

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Bob's change is discarded - Charlie is not added
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,REMOVE:bob')
  })

  it('discards changes made by a member who is concurrently demoted', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, keys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob adds Charlie to the group
    bGraph = append({
      graph: bGraph,
      action: ADD_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      keys,
    })
    expect(summary(bGraph)).toEqual('ROOT,ADD:bob,ADD:charlie')

    // 👩🏾 but concurrently,Alice removes Bob from the admin role
    aGraph = append({
      graph: aGraph,
      action: DEMOTE_BOB,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })
    expect(summary(aGraph)).toEqual('ROOT,ADD:bob,REMOVE:admin:bob')

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Bob's change is discarded
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,REMOVE:admin:bob')
  })

  it('resolves mutual concurrent removals in favor of the team founder', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, keys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob removes Alice
    bGraph = append({
      graph: bGraph,
      action: REMOVE_ALICE,
      user: bob.user,
      context: bob.graphContext,
      keys,
    })

    // 👩🏾 Alice removes Bob
    aGraph = append({
      graph: aGraph,
      action: REMOVE_BOB,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Alice created the team; Bob's change is discarded,Alice stays
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,REMOVE:bob')
  })

  it('resolves mutual concurrent removals in favor of the senior member', () => {
    // 👩🏾 Alice creates a graph and adds Charlie
    let { aGraph, keys } = setup()

    aGraph = append({
      graph: aGraph,
      action: ADD_CHARLIE_AS_ADMIN,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })

    // 👩🏾 🡒 👨🏻‍🦲 👳🏽‍♂️ Alice shares the graph with Bob and Charlie
    let bGraph = clone(aGraph)
    let cGraph = clone(aGraph)

    // 🔌❌ Now Bob and Charlie are disconnected

    // 👨🏻‍🦲 Bob removes Charlie
    bGraph = append({
      graph: bGraph,
      action: REMOVE_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      keys,
    })

    // 👳🏽‍♂️ Charlie removes Bob
    cGraph = append({
      graph: cGraph,
      action: REMOVE_BOB,
      user: charlie.user,
      context: charlie.graphContext,
      keys,
    })

    // 🔌✔ Bob and Charlie reconnect and synchronize graphs

    // ✅ Bob was added first; Charlie's change is discarded,Bob stays
    expectMergedResult(bGraph, cGraph, 'ROOT,ADD:bob,ADD:charlie,REMOVE:charlie')
  })

  it('resolves mutual concurrent demotions in favor of the team founder', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, keys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob demotes Alice
    bGraph = append({
      graph: bGraph,
      action: DEMOTE_ALICE,
      user: bob.user,
      context: bob.graphContext,
      keys,
    })

    // 👩🏾 Alice demotes Bob
    aGraph = append({
      graph: aGraph,
      action: DEMOTE_BOB,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Alice created the team; Bob's change is discarded,Alice is still an admin
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,REMOVE:admin:bob')
  })

  it('resolves circular mutual concurrent demotions in favor of the team founder', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and adds Charlie as admin
    let { aGraph, keys } = setup()

    aGraph = append({
      graph: aGraph,
      action: ADD_CHARLIE_AS_ADMIN,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })

    // 👩🏾 🡒 👨🏻‍🦲 Alice shares the graph with Bob and Charlie
    let bGraph = clone(aGraph)
    let cGraph = clone(aGraph)

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob demotes Charlie
    bGraph = append({
      graph: bGraph,
      action: DEMOTE_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      keys,
    })

    // 👳🏽‍♂️ Charlie demotes Alice
    cGraph = append({
      graph: cGraph,
      action: DEMOTE_ALICE,
      user: charlie.user,
      context: charlie.graphContext,
      keys,
    })

    // 👩🏾 Alice demotes Bob
    aGraph = append({
      graph: aGraph,
      action: DEMOTE_BOB,
      user: alice.user,
      context: alice.graphContext,
      keys,
    })

    // 🔌✔ All reconnect and synchronize graphs
    // This could happen three different ways - make sure the result is the same in all cases
    const mergedGraphs = [
      merge(aGraph, merge(cGraph, bGraph)),
      merge(bGraph, merge(cGraph, aGraph)),
      merge(cGraph, merge(aGraph, bGraph)),
    ]

    // ✅ Alice created the team; Bob's change is discarded,Alice is still an admin
    const expected = 'ROOT,ADD:bob,ADD:charlie,REMOVE:admin:bob'
    for (const graph of mergedGraphs) {
      expect(summary(graph)).toBe(expected)
    }
  })

  const expectMergedResult = (
    aGraph: TeamGraph,
    bGraph: TeamGraph,
    expected: string[] | string
  ) => {
    // 👩🏾 ⇄ 👨🏻‍🦲 They synchronize graphs
    const mergedGraph = merge(aGraph, bGraph)

    if (Array.isArray(expected)) {
      // The resolved sequence should match one of the provided options
      expect(expected).toContain(summary(mergedGraph))
    } else {
      expect(summary(mergedGraph)).toBe(expected)
    }
  }

  const summary = (graph: TeamGraph) => {
    let result = graphSummary(graph).replaceAll('_MEMBER', '').replaceAll('_ROLE', '')
    for (const user of users) {
      result = result.replaceAll(user.userId, user.userName)
    }

    return result
  }

  const { alice, bob, charlie } = userSetup('alice', 'bob', 'charlie')

  const users = [alice, bob, charlie]

  // Constant actions

  const REMOVE_ALICE = {
    type: 'REMOVE_MEMBER',
    payload: { userId: alice.userId },
  } as TeamAction

  const DEMOTE_ALICE = {
    type: 'REMOVE_MEMBER_ROLE',
    payload: { userId: alice.userId, roleName: ADMIN },
  } as TeamAction

  const ADD_BOB_AS_ADMIN = {
    type: 'ADD_MEMBER',
    payload: { member: redactUser(bob.user), roles: [ADMIN] },
  } as TeamAction

  const REMOVE_BOB = {
    type: 'REMOVE_MEMBER',
    payload: { userId: bob.userId },
  } as TeamAction

  const DEMOTE_BOB = {
    type: 'REMOVE_MEMBER_ROLE',
    payload: { userId: bob.userId, roleName: ADMIN },
  } as TeamAction

  const ADD_CHARLIE = {
    type: 'ADD_MEMBER',
    payload: { member: redactUser(charlie.user) },
  } as TeamAction

  const ADD_CHARLIE_AS_ADMIN = {
    type: 'ADD_MEMBER',
    payload: { member: redactUser(charlie.user), roles: [ADMIN] },
  } as TeamAction

  const REMOVE_CHARLIE = {
    type: 'REMOVE_MEMBER',
    payload: { userId: charlie.userId },
  } as TeamAction

  const DEMOTE_CHARLIE = {
    type: 'REMOVE_MEMBER_ROLE',
    payload: { userId: charlie.userId, roleName: ADMIN },
  } as TeamAction

  const ADD_ROLE_MANAGERS = {
    type: 'ADD_ROLE',
    payload: { roleName: 'managers' },
  } as TeamAction
})
