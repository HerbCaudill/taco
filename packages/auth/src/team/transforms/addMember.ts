import { type Member } from '../index.js'
import { type Transform } from '../types.js'

export const addMember =
  (newMember: Member): Transform =>
  state => ({
    ...state,

    // Add member to the team's list of members
    members: [
      ...state.members,
      {
        ...newMember,
        roles: [],
      },
    ],

    // Remove member's name from list of removed members (e.g. if member was removed and is now being re-added)
    removedMembers: state.removedMembers.filter(m => m.userId === newMember.userId),
  })
