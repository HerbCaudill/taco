import { type Role } from 'role/index.js'
import { type Transform } from 'team/types.js'

export const addRole =
  (newRole: Role): Transform =>
  state => ({
    ...state,
    roles: [...state.roles, newRole],
  })
