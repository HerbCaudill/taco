import { ROOT, type Reducer } from '@localfirst/crdx'
import { ADMIN } from '../role/index.js'
import { clone, composeTransforms } from '../util/index.js'
import { invalidLinkReducer } from './invalidLinkReducer.js'
import { setHead } from './setHead.js'
import {
  addDevice,
  addMember,
  addMemberRoles,
  addMessage,
  addRole,
  addServer,
  changeMemberKeys,
  changeServerKeys,
  collectLockboxes,
  postInvitation,
  removeDevice,
  removeMember,
  removeMemberRole,
  removeRole,
  removeServer,
  revokeInvitation,
  rotateKeys,
  setTeamName,
  useInvitation,
} from './transforms/index.js'
import {
  type Member,
  type TeamAction,
  type TeamContext,
  type TeamState,
  type Transform,
} from './types.js'
import { validate } from './validate.js'

/**
 * Each link has a `type` and a `payload`, just like a Redux action. So we can derive a `TeamState`
 * from a `TeamGraph`, by applying a Redux-style reducer to the array of links. The reducer runs on
 * each link in sequence, accumulating a team state.
 *
 * > *Note:* Keep in mind that this reducer is a pure function that acts on the publicly available
 * links in the signature chain, and must independently return the same result for every member. It
 * knows nothing about the current user's context, and it does not have access to any secrets. Any
 * crypto operations using secret keys that **the current user has** must happen elsewhere.
 *
 * @param state The team state as of the previous link in the signature chain.
 * @param link The current link being processed.
 */
export const reducer: Reducer<TeamState, TeamAction, TeamContext> = (state, link) => {
  // Invalid links are marked to be discarded by the MembershipResolver due to conflicting
  // concurrent actions. In most cases we just ignore these links and they don't affect state at
  // all; but in some cases we need to clean up, for example when someone's admission is reversed
  // but they already joined and had access to the chain.
  if (link.isInvalid) {
    return invalidLinkReducer(state, link)
  }

  state = clone(state)

  // Make sure this link can be applied to the previous state & doesn't put us in an invalid state
  const validation = validate(state, link)
  if (!validation.isValid) {
    throw validation.error
  }

  // Recast as TeamAction so we get type enforcement on payloads
  const action = link.body as TeamAction

  // Get all transforms and compose them into a single function
  const applyTransforms = composeTransforms([
    setHead(link),
    collectLockboxes(action.payload.lockboxes), // Any payload can include lockboxes
    ...getTransforms(action), // Get the specific transforms indicated by this action
  ])
  const newState = applyTransforms(state)

  return newState
}

/**
 * Each action type generates one or more transforms (functions that take the old state and return a
 * new state). This returns an array of transforms that are then applied in order.
 * @param action The team action (type + payload) being processed
 */
const getTransforms = (action: TeamAction): Transform[] => {
  switch (action.type) {
    case ROOT: {
      const { name, rootMember, rootDevice } = action.payload
      return [
        setTeamName(name),
        addRole({ roleName: ADMIN }), // Create the admin role
        addMember(rootMember), // Add the founding member
        addDevice(rootDevice), // Add the founding member's device
        ...addMemberRoles(rootMember.userId, [ADMIN]), // Make the founding member an admin
      ]
    }

    case 'ADD_MEMBER': {
      const { member, roles } = action.payload
      return [
        addMember(member), // Add this member to the team
        ...addMemberRoles(member.userId, roles), // Add each of these roles to the member's list of roles
      ]
    }

    case 'ADD_ROLE': {
      const newRole = action.payload
      return [
        addRole(newRole), // Add this role to the team
      ]
    }

    case 'ADD_MEMBER_ROLE': {
      const { userId, roleName } = action.payload
      return [
        ...addMemberRoles(userId, [roleName]), // Add this role to the member's list of roles
      ]
    }

    case 'REMOVE_MEMBER': {
      const { userId } = action.payload
      return [
        removeMember(userId), // Remove this member from the team
      ]
    }

    case 'ADD_DEVICE': {
      const { device } = action.payload
      return [
        addDevice(device), // Add this device to the member's list of devices
      ]
    }

    case 'REMOVE_DEVICE': {
      const { deviceId, lockboxes } = action.payload
      return [
        removeDevice(deviceId, lockboxes), // Remove this device from the member's list of devices
      ]
    }

    case 'REMOVE_ROLE': {
      const { roleName } = action.payload
      return [
        removeRole(roleName), // Remove this role from the team
      ]
    }

    case 'REMOVE_MEMBER_ROLE': {
      const { userId, roleName } = action.payload
      return [
        removeMemberRole(userId, roleName), // Remove this role from the member's list of roles
      ]
    }

    case 'INVITE_MEMBER': {
      const { invitation } = action.payload
      return [
        postInvitation(invitation), // Add the invitation to the list of open invitations.
      ]
    }

    case 'INVITE_DEVICE': {
      const { invitation } = action.payload
      return [
        postInvitation(invitation), // Add the invitation to the list of open invitations.
      ]
    }

    case 'REVOKE_INVITATION': {
      const { id } = action.payload
      return [
        revokeInvitation(id), // Mark the invitation revoked so it can't be used
      ]
    }

    case 'ADMIT_MEMBER': {
      const { id, memberKeys, userName } = action.payload
      const userId = memberKeys.name

      const member: Member = {
        userId,
        userName,
        keys: memberKeys,
        roles: [],
      }

      return [
        useInvitation(id), // Mark the invitation as used
        addMember(member), // Add this member to the team
      ]
    }

    case 'ADMIT_DEVICE': {
      const { id, device } = action.payload

      return [
        useInvitation(id), // Mark the invitation as used
        addDevice(device), // Add this device
      ]
    }

    case 'CHANGE_MEMBER_KEYS': {
      const { keys } = action.payload
      return [
        changeMemberKeys(keys), // Replace this member's public keys with the ones provided
      ]
    }

    case 'ROTATE_KEYS': {
      const { userId } = action.payload
      return [
        rotateKeys(userId), // Mark this member's keys as having been rotated (the rotated keys themselves are in the lockboxes)
      ]
    }

    case 'ADD_SERVER': {
      const { server } = action.payload
      return [
        addServer(server), // Add the specified server to the team
      ]
    }

    case 'REMOVE_SERVER': {
      const { host } = action.payload
      return [
        removeServer(host), // Remove the specified server from the team
      ]
    }

    case 'CHANGE_SERVER_KEYS': {
      const { keys } = action.payload
      return [
        changeServerKeys(keys), // Replace this server's public keys with the ones provided
      ]
    }

    case 'MESSAGE': {
      const { message } = action.payload
      return [
        addMessage(message), // Add the message to the team's message log
      ]
    }

    case 'SET_TEAM_NAME': {
      const { teamName } = action.payload
      return [
        setTeamName(teamName), // Set the team's name
      ]
    }

    default: {
      // ignore coverage
      throw unrecognizedLinkType(action)
    }
  }
}

// ignore coverage
function unrecognizedLinkType(action: never) {
  const { type } = action as TeamAction
  return new Error(`Unrecognized link type: ${type}`)
}
