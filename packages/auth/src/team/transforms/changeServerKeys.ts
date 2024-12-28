import { type Keyset } from '@localfirst/crdx'
import { type Transform } from '../types.js'

export const changeServerKeys =
  (keys: Keyset): Transform =>
  state => ({
    ...state,
    servers: state.servers.map(server =>
      server.host === keys.name
        ? {
            ...server,
            keys, // 🡐 replace keys with new ones
          }
        : server
    ),
  })
