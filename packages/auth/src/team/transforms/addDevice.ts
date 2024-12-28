import { type Device } from '../../device/index.js'
import { type Transform } from '../types.js'

export const addDevice =
  (device: Device): Transform =>
  state => {
    const { userId } = device
    return {
      ...state,

      // Add device to the member's list of devices
      members: state.members.map(member => {
        if (member.userId === userId) {
          const { devices = [] } = member

          // Don't add the device if it's already in the list
          if (devices.find(d => d.deviceId === device.deviceId)) {
            return member
          } else
            return {
              ...member,
              devices: [...devices, device],
            }
        }

        return member
      }),

      // Remove device ID from list of removed devices (e.g. if it was removed at one point and is being re-added)
      removedDevices: state.removedDevices.filter(d => d.keys.name === device.deviceId),
    }
  }
