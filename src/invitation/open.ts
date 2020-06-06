﻿import { Keys } from '/keys'
import { Invitation, InvitationPayload } from '/invitation'
import { symmetric } from '/crypto'

export const open = (invitation: Invitation, teamKeys: Keys): InvitationPayload => {
  const { secretKey } = teamKeys.encryption
  const decryptedPayload = symmetric.decrypt(invitation.encryptedPayload, secretKey)
  const invitationPayload = JSON.parse(decryptedPayload) as InvitationPayload
  return invitationPayload
}
