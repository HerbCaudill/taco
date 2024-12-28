import { type Transform } from '../types.js'

export const removeMember =
  (userId: string): Transform =>
  state => {
    const remainingMembers = state.members.filter(m => m.userId !== userId)
    const removedMember = state.members.find(m => m.userId === userId) // The member that was removed

    const removedMembers = [...state.removedMembers]
    if (removedMember) removedMembers.push(removedMember)

    return {
      ...state,
      members: remainingMembers,
      removedMembers,
    }
  }
