import { type Host } from '../../server/index.js'
import { type TeamState } from '../types.js'

export const serverWasRemoved = (state: TeamState, host: Host) =>
  state.removedServers.some(s => s.host === host)
