import { makeRandom } from '@herbcaudill/random'
import { TEST_GRAPH_KEYS as keys } from '../../util/testing/setup.js'
import { describe, expect, test } from 'vitest'
import { type RootAction, createGraph } from '../../graph/index.js'
import { type Store, createStore } from '../index.js'
import { type Reducer } from '../types.js'
import { createUser } from '../../user/index.js'
import { arrayToMap } from '../../util/index.js'

/*
This is a somewhat more complicated example, modeling the game Scrabble Attacks (created by Nancy
Hawa). See https://github.com/HerbCaudill/scrabbleattacks for rules.

This store doesn't have a custom resolver; any conflicting actions (e.g. concurrent attempts to take
the same letter) are ordered arbitrarily and dealt with in the reducer.
*/

const alice = createUser('alice', 'alice')
const bob = createUser('bob', 'bob')

const setupScrabbleAttacks = () => {
  const graph = createGraph<ScrabbleAttacksAction>({
    user: alice,
    name: 'scrabble',
    keys,
  })
  const reducer = scrabbleAttacksReducer

  // Alice starts a game and adds Bob as a player
  const aliceStore = createStore({ user: alice, graph, reducer, keys })
  aliceStore.dispatch({ type: 'ADD_PLAYER', payload: { userId: 'bob' } })

  // Bob starts with a copy of Alice's graph
  const bobStore = createStore({
    user: bob,
    graph: aliceStore.getGraph(),
    reducer,
    keys,
  })

  // To sync, each merges their graph with the other's
  const sync = () => {
    bobStore.merge(aliceStore.getGraph())
    aliceStore.merge(bobStore.getGraph())
  }

  return { aliceStore, bobStore, sync }
}

describe('scrabble attacks', () => {
  describe('createStore', () => {
    test('initial state', () => {
      const { aliceStore } = setupScrabbleAttacks()
      const { players, tiles } = aliceStore.getState()
      expect(players).toEqual([
        { userId: 'alice', words: [] },
        { userId: 'bob', words: [] },
      ])
      expect(Object.keys(tiles)).toHaveLength(100)
    })
  })

  describe('flip tiles', () => {
    test('flip one tile', () => {
      const { aliceStore } = setupScrabbleAttacks()

      const availableTiles = () =>
        Object.values(aliceStore.getState().tiles).filter(t => isAvailable(t))

      // no tiles are face up
      expect(availableTiles()).toHaveLength(0)

      // we flip one tile
      aliceStore.dispatch({ type: 'FLIP_TILE', payload: { id: 1 } })

      // now one tile is face up
      expect(availableTiles()).toHaveLength(1)
    })

    test('claim a word (tiles are available)', () => {
      const { aliceStore } = setupScrabbleAttacks()
      const availableTiles = () =>
        Object.values(aliceStore.getState().tiles).filter(t => isAvailable(t))
      const flip = omniscientlyFlipTileByLetter(aliceStore)

      // flip three tiles
      flip('C')
      flip('A')
      flip('T')
      expect(availableTiles()).toHaveLength(3)

      // claim the word 'CAT'
      aliceStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'CAT' } })
      const { players, messages } = aliceStore.getState()
      const [alice] = players

      // there are no error messages
      expect(messages).toHaveLength(0)

      // alice has the word
      expect(alice.words[0]).toEqual('CAT')

      // no tiles are available
      expect(availableTiles()).toHaveLength(0)
    })

    test('claim a word (not all tiles are available)', () => {
      const { aliceStore } = setupScrabbleAttacks()
      const flip = omniscientlyFlipTileByLetter(aliceStore)

      // flip three tiles
      flip('D')
      flip('O')
      flip('G')

      // try to claim the word 'DOLL'
      aliceStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'DOLL' } })
      const { players, messages } = aliceStore.getState()
      const [alice] = players

      // there's an error message
      expect(messages).toHaveLength(1)

      // alice doesn't have the word
      expect(alice.words).toHaveLength(0)
    })

    test('claim a word (only one instance of repeated letter available)', () => {
      const { aliceStore } = setupScrabbleAttacks()
      const flip = omniscientlyFlipTileByLetter(aliceStore)

      // flip three tiles
      flip('D')
      flip('O')
      flip('L')

      // try to claim the word 'DOLL'
      aliceStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'DOLL' } })
      const { players, messages } = aliceStore.getState()
      const [alice] = players

      // there's an error message
      expect(messages).toHaveLength(1)

      // alice doesn't have the word
      expect(alice.words).toHaveLength(0)
    })

    test('claim a word (all repeated letters available)', () => {
      const { aliceStore } = setupScrabbleAttacks()
      const flip = omniscientlyFlipTileByLetter(aliceStore)

      // flip four tiles
      flip('D')
      flip('O')
      flip('L')
      flip('L')

      // try to claim the word 'DOLL'
      aliceStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'DOLL' } })
      const { players, messages } = aliceStore.getState()
      const [alice] = players

      // there are no error messages
      expect(messages).toHaveLength(0)

      // alice has the word
      expect(alice.words[0]).toEqual('DOLL')
    })
  })

  describe('concurrent changes', () => {
    test('no conflict', () => {
      const { aliceStore, bobStore, sync } = setupScrabbleAttacks()
      const flip = omniscientlyFlipTileByLetter(aliceStore)

      // two words are available

      flip('C')
      flip('A')
      flip('T')

      flip('D')
      flip('O')
      flip('G')

      sync()

      // alice claims CAT
      aliceStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'CAT' } })

      // bob claims DOG
      bobStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'DOG' } })

      sync()

      const { players, messages } = aliceStore.getState()
      const [alice, bob] = players

      // there are no error messages
      expect(messages).toHaveLength(0)

      // alice has her word
      expect(alice.words[0]).toEqual('CAT')

      // bob has his word
      expect(bob.words[0]).toEqual('DOG')
    })

    test('claim same word', () => {
      const { aliceStore, bobStore, sync } = setupScrabbleAttacks()
      const flip = omniscientlyFlipTileByLetter(aliceStore)

      // one word is available

      flip('C')
      flip('A')
      flip('T')

      sync()

      // alice claims CAT
      aliceStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'CAT' } })

      // bob claims CAT
      bobStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'CAT' } })

      sync()

      // alice and bob converge on the same state
      expect(aliceStore.getState()).toEqual(bobStore.getState())

      const { players, messages } = aliceStore.getState()
      const [alice, bob] = players

      // there is one error message
      expect(messages).toHaveLength(1)

      // somebody got the word
      expect(alice.words.includes('CAT') || bob.words.includes('CAT')).toBe(true)
      // only one person got the word
      expect(alice.words.includes('CAT') && bob.words.includes('CAT')).toBe(false)
    })

    test('claim words using common letters', () => {
      const { aliceStore, bobStore, sync } = setupScrabbleAttacks()
      const flip = omniscientlyFlipTileByLetter(aliceStore)

      // a couple different words are available: CAT, BAT, TAB, CAB; but only one can be claimed

      flip('C')
      flip('A')
      flip('T')
      flip('B')

      sync()

      // alice claims CAT
      aliceStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'CAT' } })

      // bob claims CAB
      bobStore.dispatch({ type: 'CLAIM_WORD', payload: { word: 'CAB' } })

      sync()

      // alice and bob converge on the same state
      expect(aliceStore.getState()).toEqual(bobStore.getState())

      const { players, messages } = aliceStore.getState()
      const [alice, bob] = players

      // there is one error message
      expect(messages).toHaveLength(1)

      // somebody got the word
      expect(alice.words.includes('CAT') || bob.words.includes('CAB')).toBe(true)
      // only one person got the word
      expect(alice.words.includes('CAT') && bob.words.includes('CAB')).toBe(false)
    })
  })
})

// Scrabble Attacks stuff

// reducer

const SEED = 'test 12345'

const scrabbleAttacksReducer: Reducer<ScrabbleAttacksState, ScrabbleAttacksAction> = (
  state,
  link
) => {
  const action = link.body
  const { players, tiles, messages } = state

  switch (action.type) {
    case 'ROOT': {
      const { userId } = link.body
      const rootPlayer = { userId, words: [] }
      return {
        players: [rootPlayer],
        tiles: initialTiles(SEED),
        messages: [],
      }
    }

    case 'ADD_PLAYER': {
      const { userId } = action.payload
      const newPlayer = { userId, words: [] }
      return {
        ...state,
        players: players.concat(newPlayer),
      }
    }

    case 'FLIP_TILE': {
      const { id } = action.payload
      const tileToFlip = tiles[id]
      return {
        ...state,
        tiles: {
          ...tiles,
          [id]: {
            ...tileToFlip,
            isFaceUp: true,
          },
        },
      }
    }

    case 'CLAIM_WORD': {
      const { userId } = action
      const { word } = action.payload

      let availableTiles = Object.values(tiles).filter(t => isAvailable(t))

      const wordLetters = word.split('') as Letter[]

      // see if there's a tile to match each letter in this word
      const matchingTiles = []
      for (const letter of wordLetters) {
        const find = findByLetterIn(availableTiles)
        const matchingTile = find(letter)

        if (matchingTile === undefined) {
          // not available - abort
          const newMessage = {
            userId,
            message: `letter ${letter} not available`,
          }
          return {
            ...state,
            messages: messages.concat(newMessage),
          }
        }

        // mark this tile as taken
        matchingTiles.push({ ...matchingTile, isTaken: true })
        // remove this tile from available set
        availableTiles = availableTiles.filter(tile => tile.id !== matchingTile.id)
      }

      const takenTiles = matchingTiles.reduce(arrayToMap('id'), {})

      return {
        ...state,
        // add this word to the player's words
        players: players.map(player => {
          const words = player.userId === userId ? player.words.concat(word) : player.words
          return {
            ...player,
            words,
          }
        }),
        // mark these tiles as taken
        tiles: {
          ...tiles,
          ...takenTiles,
        },
      }
    }

    default: {
      return state
    }
  }
}

// utilities

const isAvailable = (tile: Tile) => !tile.isTaken && tile.isFaceUp

const findByLetterIn = (tiles: Tile[] | TileSet) => {
  const tileArray = Array.isArray(tiles) ? tiles : Object.values(tiles)
  return (letter: Letter) => tileArray.find(tile => tile.letter === letter)
}

const omniscientlyFlipTileByLetter = (
  store: Store<ScrabbleAttacksState, ScrabbleAttacksAction>
) => {
  return (letter: Letter) => {
    const tiles = Object.values(store.getState().tiles)
    const tileToFlip = findByLetterIn(tiles.filter(tile => !tile.isFaceUp))(letter)!
    store.dispatch({ type: 'FLIP_TILE', payload: { id: tileToFlip.id } })
  }
}

export const initialTiles = (seed: string = new Date().toISOString()) => {
  const r = makeRandom(seed)
  const randomSort = () => r.plusOrMinus()

  const nOfEach = (letter: Letter): Letter[] => {
    const N = letterMap[letter].count
    return Array.from({ length: N }).fill(letter) as Letter[]
  }

  const makeTile = (letter: Letter, i: number): Tile => {
    return {
      letter,
      id: i,
      isFaceUp: false,
      isTaken: false,
    }
  }

  const tileSet = alphabet
    // return N of each letter
    .flatMap(nOfEach)
    // scramble order
    .sort(randomSort)
    // build tiles in initial state
    .map(makeTile)

  // turn into map for easy lookup
  return tileSet.reduce(arrayToMap('id'), {})
}

// constants

export const WILD = '*'
export const letterMap = {
  A: { points: 1, count: 9 },
  B: { points: 3, count: 2 },
  C: { points: 3, count: 2 },
  D: { points: 2, count: 4 },
  E: { points: 1, count: 12 },
  F: { points: 4, count: 2 },
  G: { points: 2, count: 3 },
  H: { points: 4, count: 2 },
  I: { points: 1, count: 9 },
  J: { points: 8, count: 1 },
  K: { points: 5, count: 1 },
  L: { points: 1, count: 4 },
  M: { points: 3, count: 2 },
  N: { points: 1, count: 6 },
  O: { points: 1, count: 8 },
  P: { points: 3, count: 2 },
  Q: { points: 10, count: 1 },
  R: { points: 1, count: 6 },
  S: { points: 1, count: 4 },
  T: { points: 1, count: 6 },
  U: { points: 1, count: 4 },
  V: { points: 4, count: 2 },
  W: { points: 4, count: 2 },
  X: { points: 8, count: 1 },
  Y: { points: 4, count: 2 },
  Z: { points: 10, count: 1 },
  [WILD]: { points: 0, count: 2 },
}

export const alphabet = Object.keys(letterMap) as Letter[]

// action types

type AddPlayer = {
  type: 'ADD_PLAYER'
  payload: { userId: string }
}

type FlipTileAction = {
  type: 'FLIP_TILE'
  payload: { id: number }
}

type ClaimWordAction = {
  type: 'CLAIM_WORD'
  payload: { word: string }
}

type ScrabbleAttacksAction = RootAction | AddPlayer | FlipTileAction | ClaimWordAction

// state & related types

type ScrabbleAttacksState = {
  players: Player[]
  tiles: TileSet
  messages: Message[]
}

type Message = {
  userId: string
  message: string
}

type Player = {
  userId: string
  words: string[]
}

type Letter = keyof typeof letterMap

type Tile = {
  letter: Letter
  id: number
  isFaceUp: boolean
  isTaken: boolean
}

type TileSet = Record<number, Tile>
