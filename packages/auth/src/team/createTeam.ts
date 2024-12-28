import { createKeyset } from '@localfirst/crdx'
import { TEAM_SCOPE } from './constants.js'
import { type LocalContext } from './context.js'
import { Team } from './Team.js'

export function createTeam(teamName: string, context: LocalContext, seed?: string) {
  const teamKeys = createKeyset(TEAM_SCOPE, seed)

  return new Team({ teamName, context, teamKeys })
}
