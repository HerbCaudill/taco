import { type NetworkMessage } from '../util/testing/Network.js'
import { truncateHashes } from '@localfirst/shared'
import { type SyncMessage } from '../sync/index.js'

export const logMessages = (msgs: NetworkMessage[]) => {
  const result = msgs.map(m => JSON.stringify(networkMessageSummary(m))).join('\n')
  console.log(result)
}

export const networkMessageSummary = (m: NetworkMessage): any => {
  return {
    from: m.from,
    to: m.to,
    ...syncMessageSummary(m.body),
  }
}

export const syncMessageSummary = (m: SyncMessage): any => {
  if (m === undefined) {
    return 'DONE'
  }

  const { head, parentMap, links, need, error } = m
  const body: any = { head: head.join(',') }
  if (parentMap) body.linkMap = Object.keys(parentMap).join(',')
  if (links) body.links = Object.keys(links).join(',')
  if (need) body.need = need.join(',')
  if (error) body.error = error.message
  return truncateHashes(body)
}
