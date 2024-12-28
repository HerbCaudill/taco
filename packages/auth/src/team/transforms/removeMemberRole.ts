import { type Transform } from '../types.js'
import { KeyType } from '../../util/index.js'

export const removeMemberRole =
  (userId: string, roleName: string): Transform =>
  state => ({
    ...state,

    // Remove this role from this member's list of roles
    members: state.members.map(member => ({
      ...member,
      roles:
        member.userId === userId //
          ? member.roles.filter(r => r !== roleName) // Leave other members' roles alone
          : member.roles,
    })),

    // Remove any lockboxes this member has for this role
    lockboxes: state.lockboxes.filter(
      lockbox =>
        !(
          lockbox.recipient.name === userId &&
          lockbox.contents.type === KeyType.ROLE &&
          lockbox.contents.name === roleName
        )
    ),
  })
