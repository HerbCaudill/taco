﻿import { Client, LocalUserContext, Device, DeviceType } from '/context'
import { KeyType, newKeys } from '/keys'
import { Role } from '/role'
import { Team } from '/team'
import { LocalUser } from '/user'

export const expectToLookLikeKeyset = (maybeKeyset: any) => {
  expect(maybeKeyset).toHaveProperty('encryption')
  expect(maybeKeyset).toHaveProperty('signature')
}

const makeUser = (userName: string): LocalUser => {
  const keys = newKeys({ type: KeyType.MEMBER, name: userName })
  return { name: userName, keys }
}

// A simple little storage emulator
export const storage = {
  contents: undefined as string | undefined,
  save: (team: Team) => {
    storage.contents = team.save()
  },
  load: (context: LocalUserContext) => {
    if (storage.contents === undefined) throw new Error('need to save before you can load')
    return new Team({ source: JSON.parse(storage.contents), context })
  },
}

export const alice = makeUser('alice')
export const bob = makeUser('bob')
export const charlie = makeUser('charlie')
export const eve = makeUser('eve')

export const MANAGERS = 'managers'
export const managers: Role = { roleName: MANAGERS }

export const device: Device = {
  name: 'windows laptop',
  type: DeviceType.laptop,
}
export const client: Client = {
  name: 'test',
  version: '0',
}

export const alicesContext: LocalUserContext = { user: alice, device, client }
export const bobsContext: LocalUserContext = { user: bob, device, client }
export const defaultContext = alicesContext

export const teamChain = JSON.parse(
  new Team({ teamName: 'Spies Я Us', context: defaultContext }).save()
)
