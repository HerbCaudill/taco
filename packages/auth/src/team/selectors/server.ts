import { type Host } from '../../server/index.js'
import { type TeamState } from '../types.js'

export const server = (state: TeamState, host: Host, options = { includeRemoved: false }) => {
  const serversToSearch = [
    ...state.servers,
    ...(options.includeRemoved ? state.removedServers : []),
  ]
  const server = serversToSearch.find(s => s.host === host)

  if (server === undefined) {
    throw new Error(`A server with host '${host}' was not found`)
  }

  return server
}
