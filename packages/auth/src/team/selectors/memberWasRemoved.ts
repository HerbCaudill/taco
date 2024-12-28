import { type TeamState } from '../types.js'

export const memberWasRemoved = (state: TeamState, userId: string) => {
  return state.removedMembers.some(m => m.userId === userId)
}
