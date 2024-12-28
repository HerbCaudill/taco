import sodium from 'libsodium-wrappers-sumo'
import { base58 } from './util/index.js'
import { type Base58 } from './types.js'

/** Returns an unpredictable key with the given length (32 bytes by default), as a byte array. */
export const randomKeyBytes = (length = 32) => sodium.randombytes_buf(length)

/** Returns an unpredictable key with the given length (16 characters by default), as a base58-encoded string. */
export const randomKey = (length = 16) =>
  // we make a longer key than we need, so that we have enough base58 characters to truncate to the desired length
  base58.encode(randomKeyBytes(length * 3)).slice(0, length) as Base58
