import { type TeamState } from '../types.js'

export const role = (state: TeamState, roleName: string) => {
  const role = state.roles.find(r => r.roleName === roleName)
  if (!role) throw new Error(`A role called '${roleName}' was not found`)

  return role
}
