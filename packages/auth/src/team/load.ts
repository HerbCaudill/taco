﻿import { TeamSignatureChain } from './types'
import { LocalDeviceContext } from '@/context'
import { Team } from '@/team/Team'

export const load = (source: string | TeamSignatureChain, context: LocalDeviceContext) =>
  new Team({ source, context })
