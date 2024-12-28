import { describe, it, expect } from 'vitest'
import { getLatestGeneration } from '../getLatestGeneration.js'
import { createKeyring, createKeyset } from '../../index.js'

const TEAM_SCOPE = { type: 'TEAM', name: 'TEAM' }

describe('getLatestGeneration', () => {
  it('single generation', () => {
    const keys = createKeyset(TEAM_SCOPE)
    const keyring = createKeyring(keys)
    const latest = getLatestGeneration(keyring)
    expect(latest).toEqual(keys)
  })

  it('multiple generations', () => {
    const keys0 = createKeyset(TEAM_SCOPE)
    const keys1 = { ...createKeyset(TEAM_SCOPE), generation: 1 }
    const keys2 = { ...createKeyset(TEAM_SCOPE), generation: 2 }
    const keyring = createKeyring([keys0, keys1, keys2])
    const latest = getLatestGeneration(keyring)
    expect(latest).toEqual(keys2)
  })
})
