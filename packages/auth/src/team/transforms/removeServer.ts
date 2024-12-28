import { type Host } from '../../server/index.js'
import { type Transform } from '../types.js'

export const removeServer =
  (host: Host): Transform =>
  state => {
    const remainingServers = state.servers.filter(m => m.host !== host)
    const removedServer = state.servers.find(m => m.host === host) // The server that was removed

    const removedServers = [...state.removedServers]
    if (removedServer) {
      removedServers.push(removedServer)
    }

    return {
      ...state,
      servers: remainingServers,
      removedServers,
    }
  }
