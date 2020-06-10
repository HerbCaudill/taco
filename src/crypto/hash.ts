﻿import nacl from 'tweetnacl'
import { Key, Payload } from '/util/types'
import { keyToBytes } from '/util/keyToBytes'
import { payloadToBytes } from '/util/payloadToBytes'

export const hash = (seed: Key, payload: Payload) => {
  const seedBytes = keyToBytes(seed, 'utf8')
  const payloadBytes = payloadToBytes(payload)
  const keyAndPayload = concatenate(seedBytes, payloadBytes)
  return nacl.hash(keyAndPayload)
}

const concatenate = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const c = new Uint8Array(a.length + b.length)
  c.set(a)
  c.set(b, a.length)
  return c
}
