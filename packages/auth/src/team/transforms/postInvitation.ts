import { type Invitation } from '../../invitation/index.js'
import { type Transform } from '../types.js'

export const postInvitation =
  (invitation: Invitation): Transform =>
  state => {
    const invitationState = {
      ...invitation,
      uses: 0,
      revoked: false,
    }

    return {
      ...state,
      invitations: {
        ...state.invitations,
        [invitation.id]: invitationState,
      },
    }
  }
