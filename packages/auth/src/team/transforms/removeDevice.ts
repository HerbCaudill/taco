﻿import { Transform } from '@/team/types'
import { KeyType } from 'crdx'
import { getDeviceId } from '@/device'

export const removeDevice =
  (userName: string, deviceName: string): Transform =>
  state => {
    const deviceId = getDeviceId({ deviceName, userName })
    return {
      ...state,

      // remove this device from this member's list of devices
      members: state.members.map(member => {
        return member.userName === userName
          ? {
              ...member,
              devices: member.devices!.filter(d => d.deviceName !== deviceName),
            }
          : member
      }),

      // add the device ID to the list of removed devices
      removedDevices: [...state.removedDevices, deviceId],

      // remove any lockboxes this device has
      lockboxes: state.lockboxes.filter(
        lockbox =>
          !(
            lockbox.recipient.type === KeyType.DEVICE &&
            lockbox.recipient.name === userName &&
            lockbox.contents.name === deviceName
          )
      ),
    }
  }
