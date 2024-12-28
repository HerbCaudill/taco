import { type Transform } from '../types.js'

export const addMemberRoles = (userId: string, roles: string[] = []): Transform[] =>
  roles.map(roleName => state => ({
    ...state,
    members: state.members.map(member => ({
      ...member,
      roles:
        member.userId !== userId || member.roles.includes(roleName)
          ? member.roles
          : [...member.roles, roleName],
    })),
  }))
