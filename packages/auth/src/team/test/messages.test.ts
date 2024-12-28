import { setup } from '../../util/testing/index.js'
import { describe, expect, it } from 'vitest'

describe('Team', () => {
  describe('messages', () => {
    it('an admin member can add and retrieve a message', () => {
      const { alice } = setup('alice')

      // Alice posts a message to the team graph
      const message = {
        type: 'SUPER_IMPORTANT_MESSAGE',
        payload: {
          foo: 'pizza',
        },
      }
      alice.team.addMessage(message)

      // Alice retrieves all the messages
      const messages = alice.team.messages()

      // There's only one
      expect(messages.length).toBe(1)

      // It's the one Alice posted
      expect(messages[0]).toEqual(message)
    })

    // assuming for now this is the behavior we want
    it('a non-admin member cannot add messages', () => {
      const { bob } = setup(['alice', { user: 'bob', admin: false }])

      // Bob tries to post a message to the team graph
      const message = {
        type: 'SUPER_IMPORTANT_MESSAGE',
        payload: {
          foo: 'pizza',
        },
      }

      expect(() => bob.team.addMessage(message)).toThrow()

      expect(bob.team.messages().length).toBe(0)
    })
  })
})
