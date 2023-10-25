import { type Host } from '@/server/index.js'
import { type TeamState } from '@/team/types.js'

export const hasServer = (state: TeamState, host: Host) =>
  state.servers.find(s => s.host === host) !== undefined
