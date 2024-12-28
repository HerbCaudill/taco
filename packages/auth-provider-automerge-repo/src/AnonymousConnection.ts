import { type Message } from '@automerge/automerge-repo'
import { debug } from '@localfirst/shared'
import { AbstractConnection, type StateValue } from './AbstractConnection.js'
import { pack, unpack } from 'msgpackr'
import { type ShareId } from './types.js'

export class AnonymousConnection extends AbstractConnection {
  readonly #log: debug.Debugger
  readonly #shareId: ShareId
  readonly #sendMessage: (message: Message | AnonymousConnectionMessages) => void
  #state: 'idle' | 'connected' | 'disconnected'

  constructor({ shareId, sendMessage }: AnonymousConnectionParams) {
    super()
    this.#shareId = shareId
    this.#log = debug.extend(`auth:anonymous-connection:${this.#shareId}`)

    this.#sendMessage = (message: Message | AnonymousConnectionMessages) => {
      const serialized = pack(message)
      sendMessage(serialized)
    }
  }

  start() {
    this.#log('start')
    this.#sendMessage({
      type: 'JOIN',
      shareId: this.#shareId,
    })

    return this
  }

  stop() {
    this.#log('stop')
    this.#disconnect('stopped')

    return this
  }

  send(message: Message) {
    this.#log('send %o', message)
    this.#sendMessage(message)
  }

  deliver(serializedMessage: Uint8Array) {
    const message = unpack(serializedMessage)
    this.#log('deliver %o', message)

    if (isJoinMessage(message)) {
      if (message.shareId === this.#shareId) {
        this.#log('send welcome')
        this.#sendMessage({ type: 'WELCOME' })
      } else {
        this.#disconnect(
          `shareId doesn't match expected: ${this.#shareId} received: ${message.shareId}`
        )
      }
    } else if (isWelcomeMessage(message)) {
      this.#log('connected')
      this.#state = 'connected'
      this.emit('connected')
    } else {
      this.#log('emitting message')
      this.emit('message', message)
    }
  }

  #disconnect(message: string) {
    if (this.#state === 'disconnected') return
    this.#log('disconnect: %s', message)
    this.#state = 'disconnected'
    this.emit('disconnected', {
      type: 'DISCONNECT',
      payload: { message },
    })
  }

  get state(): StateValue {
    return this.#state
  }
}

type AnonymousConnectionParams = {
  shareId: ShareId
  sendMessage: (message: Uint8Array) => void
}

type JoinMessage = {
  type: 'JOIN'
  shareId: ShareId
}

type WelcomeMessage = {
  type: 'WELCOME'
}

function isJoinMessage(message: Message | AnonymousConnectionMessages): message is JoinMessage {
  return message.type === 'JOIN'
}

function isWelcomeMessage(
  message: Message | AnonymousConnectionMessages
): message is WelcomeMessage {
  return message.type === 'WELCOME'
}

type AnonymousConnectionMessages = JoinMessage | WelcomeMessage
