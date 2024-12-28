import { type TeamState } from '../types.js'

export const member = (state: TeamState, userId: string, options = { includeRemoved: false }) => {
  const membersToSearch = [
    ...state.members,
    ...(options.includeRemoved ? state.removedMembers : []),
  ]
  const member = membersToSearch.find(m => m.userId === userId)

  if (member === undefined) {
    throw new Error(`A member named '${userId}' was not found`)
  }

  return member
}
