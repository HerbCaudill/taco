﻿import { parseDeviceId } from '@/device'
import { Keyset } from 'crdx'
import { Transform } from '@/team/types'

export const changeDeviceKeys =
  (keys: Keyset): Transform =>
  state => {
    const { userName, deviceName } = parseDeviceId(keys.name)
    return {
      ...state,
      members: state.members.map(member => {
        if (member.userName === userName) {
          return {
            ...member,
            devices: member.devices?.map(device => {
              if (device.deviceName === deviceName)
                return {
                  ...device,
                  keys, // 🡐 replace device keys
                }
              else return device
            }),
          }
        } else return member
      }),
    }
  }
