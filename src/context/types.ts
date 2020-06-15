﻿import { KeysetWithSecrets } from '/keyset'
import { Member } from '/member'
import { User } from '/user'
import { SemVer } from '/util'

interface Context {
  client?: Client
}

export interface LocalUserContext extends Context {
  user: User
}

export interface MemberContext extends Context {
  member: Member
  device: Device
}

export enum DeviceType {
  desktop,
  laptop,
  tablet,
  mobile,
  bot,
  server,
  other,
}

export interface Device {
  name: string
  userName: string
  type: DeviceType
}

export interface DeviceWithKeys extends Device {
  keys: KeysetWithSecrets
}

export interface Client {
  name: string
  version: SemVer
}
