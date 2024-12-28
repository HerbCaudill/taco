import { type Keyset } from '@localfirst/crdx'
import { type Lockbox } from '../../lockbox/index.js'
import * as select from '../selectors/index.js'
import { type Member, type Transform } from '../types.js'
import { KeyType } from '../../util/types.js'

export const removeDevice =
  (deviceId: string, lockboxes: Lockbox[] = []): Transform =>
  state => {
    const removedDevice = select.device(state, deviceId)

    const member = select.memberByDeviceId(state, deviceId)
    const { userId } = member
    let { keys } = member
    const userLockbox = lockboxes.find(
      ({ contents }) => contents.type === KeyType.USER && contents.name === userId
    )

    // When a device is removed, the user keys are rotated and the new key
    // generation is in the lockboxes. The unencrypted lockbox contents
    // contain the meta data along with the public keys which is all we need
    // to update the user keys of the member to the latest generation.
    if (userLockbox) {
      const { type, name, generation, encryption, signature } =
        userLockbox.contents as unknown as Keyset

      if (keys.generation < generation && encryption !== undefined && signature !== undefined) {
        keys = { type, name, generation, encryption, signature }
      }
    }

    const removeDeviceFromMember = (member: Member) =>
      member.userId === userId
        ? {
            ...member,
            devices: member.devices?.filter(d => d.deviceId !== removedDevice.deviceId),
            keys,
          }
        : member

    const members = state.members.map(removeDeviceFromMember)
    const removedDevices = [...state.removedDevices, removedDevice]

    return {
      ...state,
      members,
      removedDevices,
    }
  }
