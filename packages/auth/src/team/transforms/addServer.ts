import type { Server } from '../../server/index.js'
import type { TeamState, Transform } from '../types.js'
import { unique } from '../../util/unique.js'

export const addServer =
  (newServer: Server): Transform =>
  state => {
    const newState: TeamState = {
      ...state,

      // Add server to the team's list of servers
      servers: unique([...state.servers, newServer]),

      // Remove server's url from list of removed servers (e.g. if server was removed and is now being re-added)
      removedServers: state.removedServers.filter(m => m.host !== newServer.host),
    }
    return newState
  }
