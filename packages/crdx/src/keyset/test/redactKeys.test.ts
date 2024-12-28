import { describe, expect, it } from 'vitest'
import { EPHEMERAL_SCOPE } from '../../constants.js'
import { KeyType, type KeysetWithSecrets, createKeyset, redactKeys } from '../index.js'

describe('redact', () => {
  it('should redact secrets from a random keyset', () => {
    const secretKeyset = createKeyset({ type: KeyType.USER, name: 'foo' })

    const publicKeyset = redactKeys(secretKeyset)

    expect(publicKeyset).toHaveProperty('encryption')
    expect(publicKeyset).toHaveProperty('signature')

    expect(publicKeyset.signature).not.toHaveProperty('secretKey')
    expect(publicKeyset.encryption).not.toHaveProperty('secretKey')
  })

  it('should redact secrets from a known keyset', () => {
    const secretKeyset = {
      ...EPHEMERAL_SCOPE,
      generation: 0,
      signature: {
        publicKey: 'EayujXHRETFxkKDoZCx3SaTdE3Rv0zxQ9YAaPI3eoPVxEWUL',
        secretKey: '2JRZSRcbUNOsTAH0FafvUd9PmaiVqUKXA8skc6KWvGotuAHM',
      },
      encryption: {
        publicKey: '0b1wMd4ZbapbUUKEP3WdZmvtuF9bge71OXsPJT0KbrcGPgVw',
        secretKey: 'k3a1DlPrnsd3V4fnc34gN60pV8qieqQccwvqJbqFKj1WMZ5h',
      },
      secretKey: 'ewjn7ELEjW8S1qYuKI9MDizUkD7d5FWG6c65cleud7xkFxoy',
    } as KeysetWithSecrets

    const publicKeyset = redactKeys(secretKeyset)

    expect(publicKeyset).toEqual({
      ...EPHEMERAL_SCOPE,
      encryption: '0b1wMd4ZbapbUUKEP3WdZmvtuF9bge71OXsPJT0KbrcGPgVw',
      signature: 'EayujXHRETFxkKDoZCx3SaTdE3Rv0zxQ9YAaPI3eoPVxEWUL',
      generation: 0,
    })
  })

  it('passes a public keyset back unchanged', () => {
    const secretKeyset = createKeyset({ type: KeyType.USER, name: 'foo' })
    const publicKeyset = redactKeys(secretKeyset)
    expect(redactKeys(publicKeyset)).toEqual(publicKeyset)
  })
})
