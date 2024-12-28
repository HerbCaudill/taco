import { assert } from '@localfirst/shared'
import { createKeyring, createUser, type UserWithSecrets } from '@localfirst/crdx'
import { createId } from '@paralleldrive/cuid2'
import type { Connection, Context, InviteeContext, MemberContext } from '../../connection/index.js'
import type { DeviceWithSecrets } from '../../device/index.js'
import * as devices from '../../device/index.js'
import { ADMIN } from '../../role/index.js'
import type { LocalUserContext } from '../../team/context.js'
import type { Team, TeamContext } from '../../team/index.js'
import * as teams from '../../team/index.js'
import { arrayToMap } from '../index.js'
import { phoneInfo, laptopInfo } from './constants.js'

export type SetupConfig = Array<Array<TestUserSettings | string> | TestUserSettings | string>

// ignore file coverage

/**
Usage:

```ts
const {alice, bob} = setup(['alice', 'bob'])
const {alice, bob, charlie} = setup(['alice', 'bob', {user: 'charlie', member: false}])
const {alice, bob, charlie, dwight} = setup(['alice', 'bob', 'charlie', {user: 'dwight', admin: false}])

alice.team.add('bob')
```
*/
export const setup = (..._config: SetupConfig) => {
  assert(_config.length > 0)

  // Accept `setup(['a', 'b'])` or `setup('a','b')`
  if (Array.isArray(_config[0])) {
    _config = _config[0] as Array<TestUserSettings | string>
  }

  // Coerce string userIds into TestUserSettings objects
  const config = _config.map(u => (typeof u === 'string' ? { user: u } : u)) as TestUserSettings[]

  // Get a list of just user ids
  const userNames = config.map(user => user.user)

  // Create users
  const testUsers: Record<string, UserWithSecrets> = userNames
    .map((userName: string) => {
      const randomSeed = userName // Make these predictable
      const userId = createId()
      return createUser(userName, userId, randomSeed)
    })
    .reduce(arrayToMap('userName'), {})

  const makeDevice = (userId: string, deviceName: string) => {
    const key = `${userId}-${deviceName}`
    const randomSeed = key
    const deviceInfo = deviceName === 'phone' ? phoneInfo : laptopInfo
    const device = devices.createDevice({ userId, deviceName, seed: randomSeed, deviceInfo })
    return device
  }

  const laptops = userNames.reduce<Record<string, DeviceWithSecrets>>((result, userName) => {
    const user = testUsers[userName]
    const device = makeDevice(user.userId, 'laptop')
    result[userName] = device
    return result
  }, {})

  const phones = userNames.reduce<Record<string, DeviceWithSecrets>>((result, userName) => {
    const user = testUsers[userName]
    const device = makeDevice(user.userId, 'phone')
    result[userName] = device
    return result
  }, {})

  // Create team
  const founder = userNames[0] // E.g. alice

  const founderContext = { user: testUsers[founder], device: laptops[founder] }
  const teamName = 'Spies Я Us'
  const randomSeed = teamName
  const team = teams.createTeam(teamName, founderContext, randomSeed)
  const teamKeys = team.teamKeys()

  // Add members
  for (const { user: userName, admin = true, member = true } of config) {
    const user = testUsers[userName]
    if (member && !team.has(user.userId)) {
      const user = testUsers[userName]
      const roles = admin ? [ADMIN] : []
      const device = devices.redactDevice(laptops[userName])
      team.addForTesting(user, roles, device)
    }
  }

  const { graph } = team

  const makeUserStuff = ({ user: userName, member = true }: TestUserSettings): UserStuff => {
    const user = testUsers[userName]
    const randomSeed = userName
    const device = laptops[userName]
    const phone = phones[userName]

    const localContext = { user, device }
    const graphContext = { deviceId: device.deviceId }
    const team = member
      ? teams.load(graph, localContext, createKeyring(teamKeys)) // Members get a copy of the source team
      : teams.createTeam(userName, localContext, randomSeed) // Non-members get a dummy empty placeholder team

    const connectionContext: Context = member
      ? { user, device, team }
      : { user, device, invitationSeed: '' }

    const phoneStuff: UserStuff = {
      userName,
      userId: user.userId,
      deviceId: phone.deviceId,
      user,
      team: member
        ? teams.load(graph, localContext, createKeyring(teamKeys)) // Members get a copy of the source team
        : teams.createTeam(userName, localContext, randomSeed), // Non-members get a dummy empty placeholder team
      device: phone,
      localContext: { user, device: phone },
      graphContext: { deviceId: phone.deviceId },
      connectionContext,
      connection: {} as Record<string, Connection>,
      getState: (peer: string) => phoneStuff.connection[peer].state,
    }

    const connection = {} as Record<string, Connection>
    const getState = (peer: string) => connection[peer].state

    return {
      userName: user.userName,
      userId: user.userId,
      deviceId: device.deviceId,
      user,
      team,
      device,
      localContext,
      graphContext,
      phone,
      phoneStuff,
      connectionContext,
      connection,
      getState,
    }
  }

  const testUserStuff: Record<string, UserStuff> = config
    .map(makeUserStuff)
    .reduce(arrayToMap('userName'), {})

  return testUserStuff
}

// TYPES

export type TestUserSettings = {
  user: string
  admin?: boolean
  member?: boolean
}

export type UserStuff = {
  userName: string
  userId: string
  deviceId: string
  user: UserWithSecrets
  team: Team
  device: DeviceWithSecrets
  phone?: DeviceWithSecrets
  phoneStuff?: UserStuff
  localContext: LocalUserContext
  graphContext: TeamContext
  connectionContext: MemberContext | InviteeContext
  connection: Record<string, Connection>
  getState: (peer: string) => any
}
