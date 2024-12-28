import { type Keyring, type KeysetWithSecrets, createKeyring } from '@localfirst/crdx'
import { type TeamGraph } from './types.js'
import { type LocalContext } from '../team/context.js'
import { Team } from '../team/Team.js'

export const load = (
  source: Uint8Array | TeamGraph,
  context: LocalContext,
  teamKeys: KeysetWithSecrets | Keyring
) => {
  const teamKeyring = createKeyring(teamKeys)
  return new Team({ source, context, teamKeyring })
}
