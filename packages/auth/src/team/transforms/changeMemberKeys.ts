import { type Keyset } from '@localfirst/crdx'
import { type Transform } from '../types.js'

export const changeMemberKeys =
  (keys: Keyset): Transform =>
  state => ({
    ...state,
    members: state.members.map(member =>
      member.userId === keys.name
        ? {
            ...member,
            keys, // 🡐 replace keys with new ones
          }
        : member
    ),
  })
