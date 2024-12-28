import { ADMIN } from '../../role/index.js'
import { type TeamState } from '../types.js'

export const membersInRole = (state: TeamState, roleName: string) =>
  state.members.filter(member => member.roles?.includes(roleName))

export const admins = (state: TeamState) => membersInRole(state, ADMIN)
