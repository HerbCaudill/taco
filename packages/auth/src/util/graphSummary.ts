import { getSequence } from '@localfirst/crdx'
import { actionFingerprint } from './actionFingerprint.js'
import { membershipResolver as resolver } from '../team/membershipResolver.js'
import { type TeamAction, type TeamContext, type TeamGraph } from '../team/types.js'

export const graphSummary = (graph: TeamGraph) => {
  const links = getSequence<TeamAction, TeamContext>(graph, resolver)
    .filter(l => !l.isInvalid)
    .map(l => actionFingerprint(l))
    .join(',')
  return links
}
