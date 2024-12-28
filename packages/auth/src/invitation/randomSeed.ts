import { randomKey } from '@localfirst/crypto'
import { IKEY_LENGTH } from './create.js'

/**
 * Randomly generates a 16-character base58 string, for example `4kgd5mwq5z4fmfwq`, to be used as
 * the secret key for an invitation.
 *
 * The invitation key is a sent to Bob via a pre-authenticated channel (e.g. WhatsApp). If Alice is
 * inviting Bob, only Alice and Bob will ever have this key. (Keybase docs refer to this as `iKey`.)
 *
 * > Note: Alternatively, you can come up with your own method of generating the secret key. The
 * > length of the key specified in the protocol makes it quite strong, and the choice of the base58
 * > character set omits confusing characters like `1` and `l`.
 * >
 * > Depending on the security context, it might make sense to strike a different balance between
 * > strength and human-friendliness - one application might use BIP39 word pairs (weaker but
 * > friendlier), while another might use 32-character strings using the full ASCII character set
 * > (stronger but practically impossible to remember or communicate verbally).
 * >
 * > If you'd prefer not to mess with invitation keys at all and you're fine with [Trust on First
 * > Use](https://keybase.io/blog/chat-apps-softer-than-tofu) (TOFU), you can choose a fixed key for
 * > all invitations and just hard-code that into your application so that the user never sees it.
 * >
 */
export const randomSeed = (length = IKEY_LENGTH) => randomKey(length)
