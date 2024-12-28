import { type Transform } from '../types.js'

export const setTeamName =
  (teamName: string): Transform =>
  state => ({
    ...state,
    teamName,
  })
