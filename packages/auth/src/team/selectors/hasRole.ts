import { type TeamState } from '../types.js'

export const hasRole = (state: TeamState, roleName: string) =>
  state.roles.find(r => r.roleName === roleName) !== undefined
