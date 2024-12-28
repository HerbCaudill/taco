import { type Transform } from '../types.js'

export const rotateKeys =
  (userId: string): Transform =>
  state => {
    // Remove this user name from the list of pending key rotations
    const pendingKeyRotations = state.pendingKeyRotations.filter(u => u !== userId)

    return {
      ...state,
      pendingKeyRotations,
    }
  }
