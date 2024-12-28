import { type Transform } from '../types.js'
import { KeyType } from '../../util/index.js'

export const removeRole =
  (roleName: string): Transform =>
  state => ({
    ...state,

    // Remove this role
    roles: state.roles.filter(role => role.roleName !== roleName),

    // Remove any lockboxes for this role
    lockboxes: state.lockboxes.filter(
      lockbox => !(lockbox.contents.type === KeyType.ROLE && lockbox.contents.name === roleName)
    ),
  })
