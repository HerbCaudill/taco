import { type Lockbox } from '../../lockbox/index.js'
import { type Transform } from '../types.js'

export const collectLockboxes =
  (newLockboxes?: Lockbox[]): Transform =>
  state => {
    const { lockboxes } = state
    return newLockboxes ? { ...state, lockboxes: lockboxes.concat(newLockboxes) } : state
  }
