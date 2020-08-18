import { EventEmitter } from 'events'
import { ConnectionEvent } from '/connection'

export class TestChannel extends EventEmitter {
  private peers: number = 0
  private buffer: { senderId: string; msg: ConnectionEvent }[] = []

  addPeer() {
    this.peers += 1
    if (this.peers > 1) {
      // someone was already connected, emit any buffered messages
      while (this.buffer.length > 0) {
        const { senderId, msg } = this.buffer.pop() as { senderId: string; msg: ConnectionEvent }
        this.emit('data', senderId, msg)
      }
    }
  }

  write(senderId: string, msg: any) {
    if (this.peers > 1) {
      // at least one peer besides us connected
      this.emit('data', senderId, msg)
    } else {
      // nobody else connected, buffer messages until someone connects
      this.buffer.unshift({ senderId, msg })
    }
  }
}
