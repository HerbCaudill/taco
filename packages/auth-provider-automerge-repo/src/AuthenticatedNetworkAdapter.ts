import { NetworkAdapter, type Message } from '@automerge/automerge-repo'
import { type ShareId } from './types.js'

/**
 * An AuthenticatedNetworkAdapter is a NetworkAdapter that wraps another NetworkAdapter and
 * transforms outbound messages.
 */
export class AuthenticatedNetworkAdapter<T extends NetworkAdapter> //
  extends NetworkAdapter
{
  connect: typeof NetworkAdapter.prototype.connect
  disconnect: typeof NetworkAdapter.prototype.disconnect

  isReady = false

  constructor(
    public baseAdapter: T,
    private readonly sendFn: (msg: Message) => void,
    private readonly shareIds: ShareId[] = []
  ) {
    super()

    // pass through the base adapter's connect & disconnect methods
    this.connect = this.baseAdapter.connect.bind(this.baseAdapter)
    this.disconnect = this.baseAdapter.disconnect.bind(this.baseAdapter)

    baseAdapter.on('ready', () => {
      this.isReady = true
      this.emit('ready', { network: this })
    })
  }

  send(msg: Message) {
    if (!this.isReady) {
      // wait for base adapter to be ready
      this.baseAdapter.on('ready', () => this.sendFn(msg))
    } else {
      // send immediately
      this.sendFn(msg)
    }
  }
}
