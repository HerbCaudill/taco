import { TEST_GRAPH_KEYS as keys } from '../../util/testing/setup.js'
import { describe, expect, it } from 'vitest'
import { createGraph, type Link, type Resolver, type RootAction } from '../../graph/index.js'
import { createStore } from '../index.js'
import { type Reducer } from '../types.js'
import { createUser } from '../../user/index.js'
import { type UnixTimestamp } from '../../util/index.js'

/**
 * This example simulates a meeting room scheduler and demonstrates a custom resolver implementing
 * domain-specific conflict-resolution rules.
 *
 * If two people concurrently schedule a room for overlapping times, it's considered a conflict and is
 * resolved by giving the room to the person with the most seniority.
 */
describe('scheduler', () => {
  const alice = createUser('alice', 'alice')
  const bob = createUser('bob', 'bob')

  // the person with the longest tenure wins in the case of conflicts
  const seniorityLookup: Record<string, number> = {
    alice: 10, // years
    bob: 3,
    charlie: 7,
  }

  const setup = () => {
    /**
     * The resolver enforces the rule that the most senior person wins in cases of conflict.
     */
    const resolver = (_ => {
      const seniority = (link: SchedulerLink) => seniorityLookup[link.body.userId]
      return {
        sort: (a: SchedulerLink, b: SchedulerLink) => seniority(b) - seniority(a),
      }
    }) as Resolver<SchedulerAction, SchedulerState>

    /**
     * The reducer goes through the reservation actions one by one, building up the current state.
     * Any conflicts that are found are resolved by favoring the reservation found first. The
     * resulting state contains the effective reservations
     */
    const reducer: Reducer<SchedulerState, SchedulerAction> = (state, link) => {
      const action = link.body
      const { reservations, conflicts } = state
      switch (action.type) {
        case 'ROOT': {
          return { reservations: [], conflicts: [] }
        }

        case 'MAKE_RESERVATION': {
          const newReservation = action.payload

          // look for any conflicting reservations (note that the order of the reservations has already been
          // determined by the resolver, so earlier reservations in the list take precedence over later ones)
          const conflictingReservation = Object.values(reservations).find(r =>
            overlaps(r, newReservation)
          )

          if (conflictingReservation)
            // the existing reservation stays; the new one is not added
            return {
              ...state,
              // record the conflict so the application can surface it
              conflicts: conflicts.concat({
                winner: conflictingReservation,
                loser: newReservation,
              }),
            }

          // no conflicts, so we add the new reservation
          return {
            ...state,
            reservations: reservations.concat(newReservation),
          }
        }

        default: {
          return state
        }
      }
    }

    const graph = createGraph<SchedulerAction, SchedulerState>({
      user: alice,
      name: 'scheduler',
      keys,
    })

    // everyone starts out with the same store
    const aliceStore = createStore({
      user: alice,
      graph,
      reducer,
      resolver,
      keys,
    })
    const bobStore = createStore({ user: bob, graph, reducer, resolver, keys })

    const sync = () => {
      aliceStore.merge(bobStore.getGraph())
      bobStore.merge(aliceStore.getGraph())
    }

    return { aliceStore, bobStore, sync }
  }

  it('new store', () => {
    const { aliceStore } = setup()
    const { reservations, conflicts } = aliceStore.getState()
    expect(reservations).toEqual([])
    expect(conflicts).toEqual([])
  })

  it('one reservation', () => {
    const { aliceStore } = setup()

    // alice reserves a room
    aliceStore.dispatch({
      type: 'MAKE_RESERVATION',
      payload: {
        reservedBy: 'alice',
        room: '101',
        start: new Date('2021-09-12T15:00Z').getTime() as UnixTimestamp,
        end: new Date('2021-09-12T17:00Z').getTime() as UnixTimestamp,
      },
    })

    // check the current state
    const { reservations } = aliceStore.getState()

    // there is one reservation
    expect(Object.keys(reservations)).toHaveLength(1)

    // it is the one we just made
    expect(reservations[0]).toEqual({
      reservedBy: 'alice',
      room: '101',
      start: 1_631_458_800_000,
      end: 1_631_466_000_000,
    })
  })

  it('two non-conflicting reservations', () => {
    const { aliceStore, bobStore, sync } = setup()

    // alice reserves a room
    aliceStore.dispatch({
      type: 'MAKE_RESERVATION',
      payload: {
        reservedBy: 'alice',
        room: '101',
        start: new Date('2021-09-12T15:00Z').getTime() as UnixTimestamp,
        end: new Date('2021-09-12T17:00Z').getTime() as UnixTimestamp,
      },
    })

    // bob reserves the same room for the following day
    bobStore.dispatch({
      type: 'MAKE_RESERVATION',
      payload: {
        reservedBy: 'bob',
        room: '101',
        start: new Date('2021-09-13T15:00Z').getTime() as UnixTimestamp, // 🡐 not 09-12
        end: new Date('2021-09-13T17:00Z').getTime() as UnixTimestamp,
      },
    })

    sync()

    // everyone has two reservations
    expect(Object.keys(aliceStore.getState().reservations)).toHaveLength(2)
    expect(Object.keys(bobStore.getState().reservations)).toHaveLength(2)

    // no conflicts are logged
    expect(Object.keys(aliceStore.getState().conflicts)).toHaveLength(0)
    expect(Object.keys(bobStore.getState().conflicts)).toHaveLength(0)
  })

  it('two conflicting reservations', () => {
    // repeat test to make random success less likely
    for (let i = 0; i < 5; i++) {
      const { aliceStore, bobStore, sync } = setup()

      bobStore.dispatch({
        type: 'MAKE_RESERVATION',
        payload: {
          reservedBy: 'bob',
          room: '101',
          start: new Date('2021-09-12T15:00Z').getTime() as UnixTimestamp,
          end: new Date('2021-09-12T17:00Z').getTime() as UnixTimestamp,
        },
      })

      aliceStore.dispatch({
        type: 'MAKE_RESERVATION',
        payload: {
          reservedBy: 'alice',
          room: '101',
          start: new Date('2021-09-12T15:00Z').getTime() as UnixTimestamp,
          end: new Date('2021-09-12T17:00Z').getTime() as UnixTimestamp,
        },
      })

      sync()

      // only one reservation is accepted
      expect(Object.keys(aliceStore.getState().reservations)).toHaveLength(1)
      expect(Object.keys(bobStore.getState().reservations)).toHaveLength(1)

      // the conflict is logged
      expect(Object.keys(aliceStore.getState().conflicts)).toHaveLength(1)
      expect(Object.keys(bobStore.getState().conflicts)).toHaveLength(1)

      // alice wins because she has seniority
      const conflict = aliceStore.getState().conflicts[0]
      expect(conflict.winner.reservedBy).toBe('alice')
      expect(conflict.loser.reservedBy).toBe('bob')
    }
  })

  // utilities

  const overlaps = (a: Reservation, b: Reservation) => {
    if (a.room === b.room) {
      if (a.start <= b.start && a.end > b.start) return true
      if (b.start <= a.start && b.end > a.start) return true
    }

    return false
  }
})

// action types

type MakeReservation = {
  type: 'MAKE_RESERVATION'
  payload: Reservation
}

type SchedulerAction = RootAction | MakeReservation
type SchedulerLink = Link<SchedulerAction, Record<string, unknown>>

// state

type SchedulerState = {
  reservations: Reservation[]
  conflicts: Conflict[]
}

type Reservation = {
  reservedBy: string // user name
  room: string
  start: UnixTimestamp
  end: UnixTimestamp
}

type Conflict = {
  loser: Reservation
  winner: Reservation
}
