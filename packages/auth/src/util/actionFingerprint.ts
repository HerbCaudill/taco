// ignore file coverage
import type { TeamAction, TeamLink } from '../team/types.js'

/** Identifies a unique action for the purpose of detecting duplicates;
 * e.g. ADD_MEMBER:bob
 */
export const actionFingerprint = (link: TeamLink) => {
  const fingerprintPayload = (action: TeamAction) => {
    switch (action.type) {
      case 'ADD_MEMBER': {
        return action.payload.member.userId
      }

      case 'REMOVE_MEMBER': {
        return action.payload.userId
      }

      case 'ADD_ROLE': {
        return action.payload.roleName
      }

      case 'ADD_MEMBER_ROLE':
      case 'REMOVE_MEMBER_ROLE': {
        return `${action.payload.roleName}:${action.payload.userId}`
      }

      case 'ADD_DEVICE': {
        return action.payload.device.deviceId
      }

      case 'REMOVE_DEVICE': {
        return action.payload.deviceId
      }

      case 'INVITE_MEMBER':
      case 'INVITE_DEVICE': {
        return action.payload.invitation.id
      }

      case 'REVOKE_INVITATION': {
        return action.payload.id
      }

      case 'ADMIT_MEMBER':
      case 'ADMIT_DEVICE': {
        return action.payload.id
      }

      case 'CHANGE_MEMBER_KEYS': {
        return JSON.stringify(action.payload.keys)
      }

      default: {
        // ignore coverage
        return JSON.stringify(action.payload)
      }
    }
  }

  if (link.body.type === 'ROOT') {
    return 'ROOT'
  }

  return `${link.body.type}:${fingerprintPayload(link.body)}`
}
